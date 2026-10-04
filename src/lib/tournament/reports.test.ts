import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { seededRng } from "@/engine";
import type { PrismaClient } from "@/generated/prisma/client";
import { hasTestDb, resetDb, testDb } from "../../../tests/test-db";
import { opRestartRound, opSetResult, opStartSwiss, opUndoRound } from "./ops";
import { getEventView } from "./queries";
import { addPlayerByName } from "./registration";
import { opApproveAgreedReports, pendingReports, playerReport } from "./reports";
import { createSeason, updateEventSetup } from "./season";
import { loadEvent } from "./state";

describe.skipIf(!hasTestDb)("player result reports (database)", () => {
  let db: PrismaClient;
  let admin: { id: string; runnerName: string };
  const rng = seededRng(9);
  let eventId = "";
  const users: Record<string, string> = {};

  beforeAll(() => {
    db = testDb();
  });
  beforeEach(async () => {
    await resetDb(db);
    const a = await db.user.create({
      data: { runnerName: "Org", runnerNameLower: "org", passwordHash: "x", role: "ADMIN" },
    });
    admin = { id: a.id, runnerName: "Org" };
    const s = await createSeason(db, admin, { name: "S", firstDate: "2026-01-03" });
    if (!s.ok) throw new Error();
    eventId = (await db.event.findFirstOrThrow({ where: { seasonId: s.seasonId, index: 1 } })).id;
    await updateEventSetup(db, admin, eventId, {
      name: "E1",
      date: "2026-01-03",
      month: "1",
      matchFormat: "SINGLE",
      swissRounds: "2",
      cutSize: "0",
    });
    for (const name of ["Ann", "Ben", "Cat", "Dan"]) {
      const u = await db.user.create({
        data: { runnerName: name, runnerNameLower: name.toLowerCase(), passwordHash: "x" },
      });
      users[name] = u.id;
      await addPlayerByName(db, admin, eventId, name);
    }
    await opStartSwiss(db, admin, eventId, rng);
  });
  afterAll(() => db.$disconnect());

  /** Table 0 of round 1, with its two players' names and user ids. */
  async function table0() {
    const l = await loadEvent(db, eventId);
    const m = l.state.rounds[0]!.matches[0]!;
    const aName = l.nameOf(m.a);
    const bName = l.nameOf(m.b!);
    const other = Object.keys(users).find((n) => n !== aName && n !== bName)!;
    return { aName, bName, aUser: users[aName]!, bUser: users[bName]!, outsider: users[other]! };
  }
  const report = (userId: string, outcome: "win" | "tie" | "loss", extra: object = {}) =>
    playerReport(db, userId, eventId, { phase: "swiss", round: 0, match: 0, game: 1, outcome, ...extra });

  it("players report their own match; results only count after approval", async () => {
    const t = await table0();
    expect(await report(t.aUser, "win")).toMatchObject({ ok: true });
    expect(await report(t.bUser, "loss")).toMatchObject({ ok: true });
    let view = (await getEventView(db, eventId))!;
    const m = view.swiss[0]!.matches[0]!;
    expect(m.g1).toBeNull();
    expect(m.reports?.status[1]).toBe("A");
    expect(view.agreedReports).toBe(1);
    expect(view.standings.every((s) => s.points === 0)).toBe(true);

    expect(await opApproveAgreedReports(db, admin, eventId, rng)).toMatchObject({ ok: true });
    view = (await getEventView(db, eventId))!;
    expect(view.swiss[0]!.matches[0]!.g1).toBe("A");
    expect(view.swiss[0]!.matches[0]!.reports).toBeNull();
    expect(view.standings.find((s) => s.points === 3)).toBeDefined();
    expect(await db.resultReport.count()).toBe(0);
    expect(await db.auditLog.count({ where: { action: "event.approve_reports" } })).toBe(1);
    // Both reporters move towards the Reporter badge.
    for (const u of [t.aUser, t.bUser])
      expect((await db.user.findUniqueOrThrow({ where: { id: u } })).reportsApproved).toBe(1);
  });

  it("re-reporting replaces the earlier report; disagreements are flagged and not auto-approved", async () => {
    const t = await table0();
    await report(t.aUser, "loss");
    await report(t.aUser, "win");
    await report(t.bUser, "win");
    const pending = await pendingReports(db, await loadEvent(db, eventId));
    const entry = [...pending.values()][0]!;
    expect(entry.reports).toHaveLength(2);
    expect(entry.status[1]).toBe("conflict");
    expect(await opApproveAgreedReports(db, admin, eventId, rng)).toMatchObject({ ok: false });
    // The organizer decides by entering the result directly; the reports are then cleared.
    await opSetResult(db, admin, eventId, { phase: "swiss", round: 0, match: 0, game: 1, result: "B" }, rng);
    expect(await db.resultReport.count()).toBe(0);
  });

  it("only players in the match can report, only open games, no ties in the cut", async () => {
    const t = await table0();
    expect(await report(t.outsider, "win")).toMatchObject({
      ok: false,
      error: "You can only report your own matches.",
    });
    expect(await report(t.aUser, "win", { round: 1 })).toMatchObject({ ok: false });
    expect(await report(t.aUser, "win", { game: 2 })).toMatchObject({ ok: false });
    expect(await report(t.aUser, "tie", { phase: "cut" })).toMatchObject({ ok: false });
    expect(await report(t.aUser, "maybe" as "win")).toMatchObject({ ok: false, error: "Invalid report." });
    await opSetResult(db, admin, eventId, { phase: "swiss", round: 0, match: 0, game: 1, result: "A" }, rng);
    expect(await report(t.aUser, "win")).toMatchObject({
      ok: false,
      error: expect.stringMatching(/not open/),
    });
  });

  it("restarting or undoing the round clears reports that no longer match the pairings", async () => {
    const t = await table0();
    await report(t.aUser, "tie");
    await opRestartRound(db, admin, eventId, "swiss", rng);
    const l = await loadEvent(db, eventId);
    // Any report that survives must belong to a pairing that still exists at that table.
    for (const r of await db.resultReport.findMany()) {
      const m = l.state.rounds[0]!.matches[r.match]!;
      expect([m.a, m.b]).toEqual([r.aEntrantId, r.bEntrantId]);
    }
    await opUndoRound(db, admin, eventId, "swiss");
    expect(await db.resultReport.count()).toBe(0);
  });
});
