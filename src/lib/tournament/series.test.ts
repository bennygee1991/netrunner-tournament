import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { FINALE, LEAGUE_EVENT, seededRng } from "@/engine";
import type { PrismaClient } from "@/generated/prisma/client";
import { hasTestDb, resetDb, testDb } from "../../../tests/test-db";
import { opPickSides, opSetResult, opStartCut, opStartSwiss } from "./ops";
import { getEventView } from "./queries";
import { addPlayerByName } from "./registration";
import { opApproveAgreedReports, playerReport } from "./reports";
import { createSeason, updateEventSetup } from "./season";
import { loadEvent } from "./state";

describe.skipIf(!hasTestDb)("league season format and series cut (database)", () => {
  let db: PrismaClient;
  let admin: { id: string; runnerName: string };
  const rng = seededRng(11);
  const users: Record<string, string> = {};
  let finaleId = "";
  let seasonId = "";

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
    seasonId = s.seasonId;
    finaleId = (await db.event.findFirstOrThrow({ where: { seasonId, index: 4 } })).id;
    for (const name of ["Ann", "Ben", "Cat", "Dan", "Eve"]) {
      const u = await db.user.create({
        data: { runnerName: name, runnerNameLower: name.toLowerCase(), passwordHash: "x" },
      });
      users[name] = u.id;
    }
  });
  afterAll(() => db.$disconnect());

  it("creates events 1-3 as Swiss only and the finale as Swiss + top 4 series cut", async () => {
    const events = await db.event.findMany({ where: { seasonId }, orderBy: { index: "asc" } });
    expect(events.map((e) => [e.swissRounds, e.cutSize, e.cutFormat, e.finale])).toEqual([
      [LEAGUE_EVENT.swissRounds, 0, "SINGLE", false],
      [LEAGUE_EVENT.swissRounds, 0, "SINGLE", false],
      [LEAGUE_EVENT.swissRounds, 0, "SINGLE", false],
      [FINALE.swissRounds, FINALE.cutSize, "SERIES", true],
    ]);
  });

  it("lets the organizer pick each event's format when creating a season", async () => {
    await db.season.deleteMany({});
    const fmt = (matchFormat: string, swissRounds: string, cutSize: string, cutFormat: string) => ({
      matchFormat,
      swissRounds,
      cutSize,
      cutFormat,
    });
    const bad = await createSeason(db, admin, {
      name: "Custom",
      firstDate: "2026-02-07",
      events: [
        fmt("SINGLE", "3", "0", "SINGLE"),
        fmt("SINGLE", "99", "0", "SINGLE"),
        fmt("SINGLE", "", "0", "SINGLE"),
        fmt("SINGLE", "", "4", "SERIES"),
      ],
    });
    expect(bad).toMatchObject({ ok: false, fieldErrors: { "e2.swissRounds": expect.any(String) } });
    const ok = await createSeason(db, admin, {
      name: "Custom",
      firstDate: "2026-02-07",
      events: [
        fmt("DOUBLE", "", "0", "SINGLE"),
        fmt("SINGLE", "4", "4", "SINGLE"),
        fmt("DOUBLE", "2", "0", "SERIES"),
        fmt("DOUBLE", "3", "8", "SERIES"),
      ],
    });
    if (!ok.ok) throw new Error(JSON.stringify(ok));
    const events = await db.event.findMany({ where: { seasonId: ok.seasonId }, orderBy: { index: "asc" } });
    expect(events.map((e) => [e.matchFormat, e.swissRounds, e.cutSize, e.cutFormat, e.finale])).toEqual([
      ["DOUBLE", null, 0, "SINGLE", false],
      ["SINGLE", 4, 4, "SINGLE", false],
      ["DOUBLE", 2, 0, "SERIES", false],
      ["DOUBLE", 3, 8, "SERIES", true],
    ]);
  });

  /** Finale with 1 Swiss round so the cut is quick to reach; Ann..Dan win/lose to set seeds. */
  async function finaleAtCut() {
    const ev = await db.event.findUniqueOrThrow({ where: { id: finaleId } });
    const setup = await updateEventSetup(db, admin, finaleId, {
      name: ev.name,
      date: ev.date.toISOString().slice(0, 10),
      month: "2",
      matchFormat: "SINGLE",
      swissRounds: "1",
      cutSize: "4",
    });
    expect(setup.ok).toBe(true);
    for (const n of Object.keys(users)) await addPlayerByName(db, admin, finaleId, n);
    await opStartSwiss(db, admin, finaleId, rng);
    const l = await loadEvent(db, finaleId);
    for (const [mi, m] of l.state.rounds[0]!.matches.entries()) {
      if (!m.b) continue;
      await opSetResult(
        db,
        admin,
        finaleId,
        { phase: "swiss", round: 0, match: mi, game: 1, result: "A" },
        rng,
      );
    }
    const cut = await opStartCut(db, admin, finaleId, rng);
    expect(cut).toMatchObject({ ok: true });
    return loadEvent(db, finaleId);
  }

  const userOf = (l: Awaited<ReturnType<typeof loadEvent>>, entrantId: string) =>
    l.entrants.find((e) => e.id === entrantId)!.userId!;

  it("only the higher seed (or the organizer) picks sides; players report all three games", async () => {
    let l = await finaleAtCut();
    const m = l.state.cut[0]!.matches[0]!;
    let view = (await getEventView(db, finaleId))!;
    const mv = view.cut[0]!.matches[0]!;
    expect(mv.series).toMatchObject({ pickerId: m.a, decider: false, winnerId: null });
    // Seed 1 is side a in the bracket (1 v 4), so b is the lower seed.
    const lower = { id: userOf(l, m.b!), runnerName: "x" };
    expect(
      await opPickSides(db, lower, finaleId, { round: 0, match: 0, corpId: m.b }, lower.id),
    ).toMatchObject({ ok: false, error: "Only the higher seed picks sides for this match." });
    // Nothing to report before sides are picked.
    expect(
      await playerReport(db, userOf(l, m.a), finaleId, {
        phase: "cut",
        round: 0,
        match: 0,
        game: 1,
        outcome: "win",
      }),
    ).toMatchObject({ ok: false });

    const higher = { id: userOf(l, m.a), runnerName: "y" };
    expect(
      await opPickSides(db, higher, finaleId, { round: 0, match: 0, corpId: m.a }, higher.id),
    ).toMatchObject({ ok: true });
    expect(await db.auditLog.count({ where: { action: "event.pick_sides" } })).toBe(1);

    // Game 1 to the higher seed, game 2 to the lower seed: 1-1, game 3 with coin-flip sides.
    const report = (user: string, game: 1 | 2 | 3, outcome: "win" | "loss") =>
      playerReport(db, user, finaleId, { phase: "cut", round: 0, match: 0, game, outcome });
    await report(higher.id, 1, "win");
    await report(lower.id, 1, "loss");
    await report(higher.id, 2, "loss");
    await report(lower.id, 2, "win");
    expect(await report(higher.id, 3, "win")).toMatchObject({ ok: false }); // not needed yet
    expect(await opApproveAgreedReports(db, admin, finaleId, rng)).toMatchObject({ ok: true });
    view = (await getEventView(db, finaleId))!;
    expect(view.cut[0]!.matches[0]!.series).toMatchObject({ decider: true, winnerId: null });
    expect(view.cut[0]!.matches[0]!.series!.corp3Id).not.toBeNull();

    await report(higher.id, 3, "win");
    await report(lower.id, 3, "loss");
    expect(await opApproveAgreedReports(db, admin, finaleId, rng)).toMatchObject({ ok: true });
    view = (await getEventView(db, finaleId))!;
    expect(view.cut[0]!.matches[0]!.series!.winnerId).toBe(m.a);
    l = await loadEvent(db, finaleId);
    expect(l.state.cut[0]!.matches[0]).toMatchObject({ g1: "A", g2: "B", g3: "A" });
  });

  it("runs the finale to a champion with double points and records cut losses", async () => {
    let l = await finaleAtCut();
    for (let round = 0; round < 2; round++) {
      for (const [mi, m] of l.state.cut[round]!.matches.entries()) {
        await opPickSides(db, admin, finaleId, { round, match: mi, corpId: m.a });
        // Higher seed (side a) wins 2-1.
        for (const [game, result] of [
          [1, "A"],
          [2, "B"],
          [3, "A"],
        ] as const) {
          const r = await opSetResult(
            db,
            admin,
            finaleId,
            { phase: "cut", round, match: mi, game, result },
            rng,
          );
          expect(r).toMatchObject({ ok: true });
        }
      }
      l = await loadEvent(db, finaleId);
    }
    expect(l.state.status).toBe("done");
    const champ = await db.eventRecord.findFirstOrThrow({
      where: { eventKey: finaleId, placing: "Champion" },
    });
    expect(champ).toMatchObject({ points: 10 * FINALE.pointsMultiplier, madeCut: true, cutLosses: 2 });
    expect(await db.trophy.count({ where: { eventId: finaleId, kind: "finale-champion" } })).toBe(1);
  });
});
