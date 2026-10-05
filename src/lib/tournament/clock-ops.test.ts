import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { ROUND_MINUTES, seededRng } from "@/engine";
import type { PrismaClient } from "@/generated/prisma/client";
import { hasTestDb, resetDb, testDb } from "../../../tests/test-db";
import { opClock } from "./clock-ops";
import { createOneOffEvent } from "./one-off";
import { opPairNext, opSetResult, opStartSwiss } from "./ops";
import { getEventView } from "./queries";
import { addPlayerByName } from "./registration";

describe.skipIf(!hasTestDb)("round clock (database)", () => {
  let db: PrismaClient;
  let admin: { id: string; runnerName: string };
  let eventId = "";
  const rng = seededRng(2);
  const t = (min: number) => new Date(Date.UTC(2026, 0, 1, 18, 0) + min * 60_000);

  beforeAll(() => {
    db = testDb();
  });
  beforeEach(async () => {
    await resetDb(db);
    const a = await db.user.create({
      data: { runnerName: "Org", runnerNameLower: "org", passwordHash: "x", role: "ADMIN" },
    });
    admin = { id: a.id, runnerName: "Org" };
    const r = await createOneOffEvent(db, admin, {
      name: "Clock test",
      date: "2026-01-01",
      matchFormat: "DOUBLE",
      swissRounds: "2",
      cutSize: "0",
      cutFormat: "SERIES",
    });
    if (!r.ok) throw new Error();
    eventId = r.eventId;
    for (const n of ["Ann", "Ben"]) await addPlayerByName(db, admin, eventId, n);
  });
  afterAll(() => db.$disconnect());

  const clock = (op: string, now: Date, target = "round") => opClock(db, admin, eventId, { target, op }, now);

  it("only runs during a round; 65 minutes double-sided; pause, +1 and restart; resets each round", async () => {
    expect(await clock("start", t(0))).toMatchObject({ ok: false, error: "No round is being played." });
    await opStartSwiss(db, admin, eventId, rng);
    let view = (await getEventView(db, eventId))!;
    expect(view.clock).toMatchObject({ label: "Round 1 clock", limitMin: ROUND_MINUTES.double, main: null });

    expect(await clock("pause", t(0))).toMatchObject({ ok: false });
    expect(await clock("start", t(0))).toMatchObject({ ok: true });
    expect(await clock("pause", t(10))).toMatchObject({ ok: true });
    expect(await clock("add", t(11))).toMatchObject({ ok: true });
    view = (await getEventView(db, eventId))!;
    expect(view.clock!.main).toMatchObject({ addedSec: 60, pausedAt: t(10).toISOString() });
    expect(await clock("decider", t(12), "decider")).toMatchObject({ ok: false });
    expect(await db.auditLog.count({ where: { action: "event.clock" } })).toBe(1); // start only

    for (const game of [1, 2] as const)
      await opSetResult(db, admin, eventId, { phase: "swiss", round: 0, match: 0, game, result: "A" }, rng);
    await opPairNext(db, admin, eventId, rng);
    view = (await getEventView(db, eventId))!;
    expect(view.clock).toMatchObject({ label: "Round 2 clock", main: null });
  });
});
