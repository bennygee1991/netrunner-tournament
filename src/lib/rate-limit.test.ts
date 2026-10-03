import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import type { PrismaClient } from "@/generated/prisma/client";
import { hasTestDb, resetDb, testDb } from "../../tests/test-db";
import { clear, consume, peek, sweepExpired } from "./rate-limit";

describe.skipIf(!hasTestDb)("rate limit (database)", () => {
  let db: PrismaClient;
  beforeAll(() => {
    db = testDb();
  });
  beforeEach(() => resetDb(db));
  afterAll(() => db.$disconnect());

  it("allows up to the limit then blocks with a retry time", async () => {
    for (let i = 0; i < 3; i++) expect((await consume(db, "k", 3, 60_000)).ok).toBe(true);
    const blocked = await consume(db, "k", 3, 60_000);
    expect(blocked.ok).toBe(false);
    if (!blocked.ok) expect(blocked.retryAfterSec).toBeGreaterThan(0);
  });

  it("peek does not count and reports blocked once the limit is reached", async () => {
    expect((await peek(db, "p", 2)).ok).toBe(true);
    await consume(db, "p", 2, 60_000);
    expect((await peek(db, "p", 2)).ok).toBe(true);
    await consume(db, "p", 2, 60_000);
    expect((await peek(db, "p", 2)).ok).toBe(false);
  });

  it("resets after the window expires", async () => {
    await consume(db, "w", 1, 1);
    await new Promise((r) => setTimeout(r, 20));
    expect((await consume(db, "w", 1, 60_000)).ok).toBe(true);
  });

  it("keys are independent and clear() resets one key", async () => {
    await consume(db, "a", 1, 60_000);
    expect((await consume(db, "a", 1, 60_000)).ok).toBe(false);
    expect((await consume(db, "b", 1, 60_000)).ok).toBe(true);
    await clear(db, "a");
    expect((await consume(db, "a", 1, 60_000)).ok).toBe(true);
  });

  it("sweepExpired removes only expired buckets", async () => {
    await consume(db, "old", 5, 1);
    await consume(db, "new", 5, 60_000);
    await new Promise((r) => setTimeout(r, 20));
    await sweepExpired(db);
    expect((await db.rateLimit.findMany()).map((r) => r.key)).toEqual(["new"]);
  });
});
