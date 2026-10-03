/**
 * Restores a JSON backup (downloaded from Admin > Dashboard) into an EMPTY database.
 *
 *   pnpm db:migrate                          # create the tables first
 *   pnpm db:restore path/to/circuit-backup-2026-10-03.json
 *
 * Uses DATABASE_URL (and DIRECT_URL if set). Refuses to touch a database that already has data.
 */
import "dotenv/config";
import { readFileSync } from "node:fs";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client";
import { importBackup } from "../src/lib/backup";

async function main() {
  const file = process.argv[2];
  if (!file) throw new Error("Usage: pnpm db:restore <backup.json>");
  const url = process.env.DIRECT_URL || process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL is not set");
  const db = new PrismaClient({ adapter: new PrismaPg({ connectionString: url }) });
  try {
    const counts = await importBackup(db, JSON.parse(readFileSync(file, "utf8")));
    console.log(
      "Restored:",
      Object.entries(counts)
        .map(([t, n]) => `${t} ${n}`)
        .join(", "),
    );
  } finally {
    await db.$disconnect();
  }
}

main().catch((err: unknown) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
