import type { PrismaClient } from "@/generated/prisma/client";

export type LimitResult = { ok: true } | { ok: false; retryAfterSec: number };

type Row = { count: number; resetAt: Date };

/**
 * Fixed-window counter stored in Postgres so it works across serverless instances.
 * Atomically increments `key` and reports whether the count is within `limit` for this window.
 */
export async function consume(
  db: PrismaClient,
  key: string,
  limit: number,
  windowMs: number,
): Promise<LimitResult> {
  const resetAt = new Date(Date.now() + windowMs);
  const rows = await db.$queryRaw<Row[]>`
    INSERT INTO "RateLimit" ("key", "count", "resetAt") VALUES (${key}, 1, ${resetAt})
    ON CONFLICT ("key") DO UPDATE SET
      "count"   = CASE WHEN "RateLimit"."resetAt" <= now() THEN 1 ELSE "RateLimit"."count" + 1 END,
      "resetAt" = CASE WHEN "RateLimit"."resetAt" <= now() THEN ${resetAt} ELSE "RateLimit"."resetAt" END
    RETURNING "count", "resetAt"`;
  return toResult(rows[0], limit, true);
}

/** Reports whether `key` is already over `limit` without counting this call. */
export async function peek(db: PrismaClient, key: string, limit: number): Promise<LimitResult> {
  const row = await db.rateLimit.findUnique({ where: { key } });
  if (!row || row.resetAt <= new Date()) return { ok: true };
  return toResult(row, limit, false);
}

export async function clear(db: PrismaClient, key: string): Promise<void> {
  await db.rateLimit.deleteMany({ where: { key } });
}

/** Deletes expired buckets. Cheap; called opportunistically. */
export async function sweepExpired(db: PrismaClient): Promise<void> {
  await db.rateLimit.deleteMany({ where: { resetAt: { lte: new Date() } } });
}

function toResult(row: Row | undefined, limit: number, inclusive: boolean): LimitResult {
  if (!row) return { ok: true };
  const over = inclusive ? row.count > limit : row.count >= limit;
  if (!over) return { ok: true };
  return { ok: false, retryAfterSec: Math.max(1, Math.ceil((row.resetAt.getTime() - Date.now()) / 1000)) };
}

function envInt(name: string, fallback: number): number {
  const v = Number(process.env[name]);
  return Number.isFinite(v) && v > 0 ? v : fallback;
}

/** Limits, overridable by env for tests. */
export const LIMITS = {
  get loginPerIp() {
    return { limit: envInt("RATE_LIMIT_LOGIN_IP", 30), windowMs: 15 * 60_000 };
  },
  get loginFailuresPerAccount() {
    return { limit: envInt("RATE_LIMIT_LOGIN_ACCOUNT", 10), windowMs: 15 * 60_000 };
  },
  get registerPerIp() {
    return { limit: envInt("RATE_LIMIT_REGISTER_IP", 5), windowMs: 60 * 60_000 };
  },
};
