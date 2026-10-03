import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import type { PrismaClient } from "@/generated/prisma/client";
import { hasTestDb, resetDb, testDb } from "../../tests/test-db";
import { verifyPassword } from "./password";
import { seedAdmin } from "./seed-admin";

describe.skipIf(!hasTestDb)("seedAdmin (database)", () => {
  let db: PrismaClient;
  beforeAll(() => {
    db = testDb();
  });
  beforeEach(() => resetDb(db));
  afterAll(() => db.$disconnect());

  const env = { ADMIN_RUNNER_NAME: "The Organizer", ADMIN_PASSWORD: "seed admin pass 42" };

  it("creates the first admin with an argon2id hash", async () => {
    expect(await seedAdmin(db, env)).toEqual({ status: "created", runnerName: "The Organizer" });
    const user = await db.user.findUniqueOrThrow({ where: { runnerNameLower: "the organizer" } });
    expect(user.role).toBe("ADMIN");
    expect(user.passwordHash).not.toContain(env.ADMIN_PASSWORD);
    expect(await verifyPassword(user.passwordHash, env.ADMIN_PASSWORD)).toBe(true);
  });

  it("is a no-op when an admin already exists", async () => {
    await seedAdmin(db, env);
    const again = await seedAdmin(db, { ...env, ADMIN_RUNNER_NAME: "Someone Else" });
    expect(again.status).toBe("skipped");
    expect(await db.user.count()).toBe(1);
  });

  it("explains what to set when no admin exists and nothing is configured", async () => {
    await expect(seedAdmin(db, {})).rejects.toThrow(/Set ADMIN_RUNNER_NAME and ADMIN_PASSWORD/);
  });

  it("rejects a weak password", async () => {
    await expect(seedAdmin(db, { ...env, ADMIN_PASSWORD: "password123" })).rejects.toThrow(/too common/);
  });

  it("rejects an invalid runner name", async () => {
    await expect(seedAdmin(db, { ...env, ADMIN_RUNNER_NAME: "x" })).rejects.toThrow(/ADMIN_RUNNER_NAME/);
  });

  it("refuses a runner name already used by a player (case-insensitive)", async () => {
    await db.user.create({
      data: { runnerName: "the organizer", runnerNameLower: "the organizer", passwordHash: "x" },
    });
    await expect(seedAdmin(db, env)).rejects.toThrow(/already used/);
  });
});
