import type { PrismaClient } from "@/generated/prisma/client";

/**
 * Whole-league backup as JSON: every table except login sessions and rate-limit counters.
 * Contains password hashes (argon2id) and emails, so keep backup files private.
 */
export const BACKUP_FORMAT = "netrunner-circuit-backup";
export const BACKUP_VERSION = 1;

/** Tables in dependency order (parents first) for restore. */
const TABLES = [
  "user",
  "season",
  "event",
  "entrant",
  "signup",
  "round",
  "match",
  "leaderboardSnapshot",
  "eventRecord",
  "trophy",
  "guidePage",
  "guideRevision",
  "auditLog",
] as const;
type Table = (typeof TABLES)[number];

export interface Backup {
  format: typeof BACKUP_FORMAT;
  version: number;
  createdAt: string;
  counts: Record<Table, number>;
  tables: Record<Table, Record<string, unknown>[]>;
}

// Prisma delegates share findMany/createMany/count; index them dynamically by table name.
type Delegate = {
  findMany(args?: object): Promise<Record<string, unknown>[]>;
  createMany(args: { data: Record<string, unknown>[] }): Promise<{ count: number }>;
  count(): Promise<number>;
};
function delegate(db: PrismaClient, t: Table): Delegate {
  return (db as unknown as Record<Table, Delegate>)[t];
}

export async function exportBackup(db: PrismaClient): Promise<Backup> {
  const tables = {} as Backup["tables"];
  const counts = {} as Backup["counts"];
  for (const t of TABLES) {
    tables[t] = await delegate(db, t).findMany();
    counts[t] = tables[t].length;
  }
  return {
    format: BACKUP_FORMAT,
    version: BACKUP_VERSION,
    createdAt: new Date().toISOString(),
    counts,
    tables,
  };
}

const DATE_KEYS = new Set(["date", "startDate", "eventDate"]);
const ISO = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d+)?Z$/;

function revive(row: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(row)) {
    out[k] = typeof v === "string" && (k.endsWith("At") || DATE_KEYS.has(k)) && ISO.test(v) ? new Date(v) : v;
  }
  return out;
}

function withEventKey(row: Record<string, unknown>): Record<string, unknown> {
  if (typeof row.eventKey === "string") return row;
  const date =
    row.eventDate instanceof Date ? row.eventDate.toISOString().slice(0, 10) : String(row.eventDate);
  return { ...row, eventKey: row.eventId ?? `${String(row.seasonName)}|${date}|${String(row.eventName)}` };
}

/**
 * Restores a backup into an EMPTY database (after `pnpm db:migrate`). Refuses if any table already
 * has rows, so it can never merge into or overwrite live data.
 */
export async function importBackup(db: PrismaClient, raw: unknown): Promise<Record<Table, number>> {
  const b = raw as Partial<Backup>;
  if (!b || b.format !== BACKUP_FORMAT || typeof b.tables !== "object") {
    throw new Error("This file is not a Netrunner Circuit backup.");
  }
  if (b.version !== BACKUP_VERSION) throw new Error(`Unsupported backup version ${String(b.version)}.`);
  for (const t of TABLES) {
    if ((await delegate(db, t).count()) > 0) {
      throw new Error(`The database is not empty (table ${t} has rows). Restore only into a fresh database.`);
    }
  }
  const restored = {} as Record<Table, number>;
  await db.$transaction(
    async (tx) => {
      for (const t of TABLES) {
        let rows = (b.tables![t] ?? []).map(revive);
        // Backups from before badges have no event key: derive the same one the migration uses.
        if (t === "eventRecord") rows = rows.map(withEventKey);
        restored[t] = rows.length
          ? (await delegate(tx as unknown as PrismaClient, t).createMany({ data: rows })).count
          : 0;
      }
    },
    { timeout: 120_000 },
  );
  return restored;
}
