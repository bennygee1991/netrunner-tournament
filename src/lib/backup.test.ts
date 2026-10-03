import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { seededRng } from "@/engine";
import type { PrismaClient } from "@/generated/prisma/client";
import { hasTestDb, resetDb, testDb } from "../../tests/test-db";
import { BACKUP_FORMAT, exportBackup, importBackup } from "./backup";
import { opFinish, opSetResult, opStartSwiss } from "./tournament/ops";
import { addPlayerByName } from "./tournament/registration";
import { createSeason, updateEventSetup } from "./tournament/season";
import { getEventView } from "./tournament/queries";

describe.skipIf(!hasTestDb)("backup and restore (database)", () => {
  let db: PrismaClient;
  beforeAll(() => {
    db = testDb();
  });
  beforeEach(() => resetDb(db));
  afterAll(() => db.$disconnect());

  it("round-trips the whole league through JSON, excluding sessions", async () => {
    const admin = await db.user.create({
      data: {
        runnerName: "Org",
        runnerNameLower: "org",
        passwordHash: "$argon2id$x",
        role: "ADMIN",
        bio: "hi",
      },
    });
    await db.session.create({
      data: { id: "secret-session", userId: admin.id, expiresAt: new Date(Date.now() + 1e6) },
    });
    const actor = { id: admin.id, runnerName: "Org" };
    const s = await createSeason(db, actor, { name: "Backup Season", firstDate: "2026-05-02" });
    if (!s.ok) throw new Error();
    const ev = (await db.event.findFirstOrThrow({ where: { index: 1 } })).id;
    await updateEventSetup(db, actor, ev, {
      name: "E",
      date: "2026-05-02",
      month: "1",
      matchFormat: "SINGLE",
      swissRounds: "1",
      cutSize: "0",
    });
    await addPlayerByName(db, actor, ev, "Alpha Guest");
    await addPlayerByName(db, actor, ev, "Beta Guest");
    const rng = seededRng(1);
    await opStartSwiss(db, actor, ev, rng);
    await opSetResult(db, actor, ev, { phase: "swiss", round: 0, match: 0, game: 1, result: "D" }, rng);
    await opFinish(db, actor, ev);
    const before = await getEventView(db, ev);

    const backup = JSON.parse(JSON.stringify(await exportBackup(db)));
    expect(backup.format).toBe(BACKUP_FORMAT);
    expect(JSON.stringify(backup)).not.toContain("secret-session");
    expect(backup.counts).toMatchObject({
      user: 1,
      season: 1,
      event: 4,
      entrant: 2,
      match: 1,
      eventRecord: 2,
      trophy: 1,
    });

    await expect(importBackup(db, backup)).rejects.toThrow(/not empty/);
    await resetDb(db);
    const restored = await importBackup(db, backup);
    expect(restored).toEqual(backup.counts);

    const after = await getEventView(db, ev);
    expect(after!.standings).toEqual(before!.standings);
    expect(after!.meta).toEqual(before!.meta);
    const user = await db.user.findUniqueOrThrow({ where: { id: admin.id } });
    expect(user).toMatchObject({ passwordHash: "$argon2id$x", bio: "hi", role: "ADMIN" });
    expect(user.createdAt).toBeInstanceOf(Date);
    expect(await db.session.count()).toBe(0);
  });

  it("rejects files that are not backups", async () => {
    await expect(importBackup(db, { hello: 1 })).rejects.toThrow(/not a Netrunner Circuit backup/);
    await expect(importBackup(db, { format: BACKUP_FORMAT, version: 99, tables: {} })).rejects.toThrow(
      /version/,
    );
  });
});
