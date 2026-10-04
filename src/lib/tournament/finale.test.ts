import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { seededRng } from "@/engine";
import type { PrismaClient } from "@/generated/prisma/client";
import { hasTestDb, resetDb, testDb } from "../../../tests/test-db";
import { getLiveBoards } from "./leaderboards";
import { opFinish, opPairNext, opSetResult, opStartCut, opStartSwiss } from "./ops";
import { getEventView } from "./queries";
import { addPlayerByName } from "./registration";
import { createSeason, updateEventSetup } from "./season";
import { loadEvent } from "./state";

describe.skipIf(!hasTestDb)("season finale (database)", () => {
  let db: PrismaClient;
  let admin: { id: string; runnerName: string };
  const rng = seededRng(21);

  beforeAll(() => {
    db = testDb();
  });
  beforeEach(async () => {
    await resetDb(db);
    const a = await db.user.create({
      data: { runnerName: "Org", runnerNameLower: "org", passwordHash: "x", role: "ADMIN" },
    });
    admin = { id: a.id, runnerName: "Org" };
  });
  afterAll(() => db.$disconnect());

  const PLAYERS = Array.from({ length: 10 }, (_, i) => `Player ${String.fromCharCode(65 + i)}`);

  /** Swiss-only event where `winner` wins every game it plays. */
  async function playSwissOnly(eventId: string, players: string[], winner: string) {
    const ev = await db.event.findUniqueOrThrow({ where: { id: eventId } });
    await updateEventSetup(db, admin, eventId, {
      name: ev.name,
      date: ev.date.toISOString().slice(0, 10),
      month: String(ev.month),
      matchFormat: "SINGLE",
      swissRounds: "1",
      cutSize: "0",
    });
    for (const p of players) await addPlayerByName(db, admin, eventId, p);
    await opStartSwiss(db, admin, eventId, rng);
    const l = await loadEvent(db, eventId);
    for (const [mi, m] of l.state.rounds[0]!.matches.entries()) {
      if (!m.b) continue;
      const result = l.nameOf(m.b) === winner ? "B" : "A";
      await opSetResult(db, admin, eventId, { phase: "swiss", round: 0, match: mi, game: 1, result }, rng);
    }
    const r = await opFinish(db, admin, eventId);
    if (!r.ok) throw new Error(r.error);
  }

  it("seeds the finale cut from the Season board and doubles its league points", async () => {
    const s = await createSeason(db, admin, { name: "S", firstDate: "2026-01-03" });
    if (!s.ok) throw new Error();
    const events = await db.event.findMany({ where: { seasonId: s.seasonId }, orderBy: { index: "asc" } });
    const finale = events[3]!;
    expect(finale).toMatchObject({ name: "Season finale", finale: true, swissRounds: 1, cutSize: 8 });

    // Player J dominates the season: wins events 1-3 (each 2-player event, J vs one other).
    for (const [i, opp] of ["Player A", "Player B", "Player C"].entries()) {
      await playSwissOnly(events[i]!.id, ["Player J", opp], "Player J");
    }

    for (const p of PLAYERS) await addPlayerByName(db, admin, finale.id, p);
    await opStartSwiss(db, admin, finale.id, rng);
    let view = (await getEventView(db, finale.id))!;
    expect(view.meta.finale).toBe(true);
    expect(view.seasonSeeding![0]).toMatchObject({ name: "Player J", seed: 1, seasonTotal: 30, inCut: true });

    // J loses the only Swiss round, but still tops the cut as season leader.
    const l = await loadEvent(db, finale.id);
    for (const [mi, m] of l.state.rounds[0]!.matches.entries()) {
      if (!m.b) continue;
      const jIsA = l.nameOf(m.a) === "Player J";
      const jIsB = l.nameOf(m.b) === "Player J";
      const result = jIsA ? "B" : jIsB ? "A" : "A";
      await opSetResult(db, admin, finale.id, { phase: "swiss", round: 0, match: mi, game: 1, result }, rng);
    }
    expect(await opPairNext(db, admin, finale.id, rng)).toMatchObject({ ok: false });
    expect(await opStartCut(db, admin, finale.id, rng)).toMatchObject({ ok: true });

    view = (await getEventView(db, finale.id))!;
    expect(view.cut[0]!.matches).toHaveLength(4);
    expect(view.cut[0]!.matches[0]!.a.name).toBe("Player J");
    const stored = await db.event.findUniqueOrThrow({ where: { id: finale.id } });
    expect(Array.isArray(stored.cutSeedOrder)).toBe(true);
    const audit = await db.auditLog.findFirstOrThrow({ where: { action: "event.start_cut" } });
    expect(audit.detailJson).toMatchObject({ seeding: "season standings (finale)" });

    // Play the cut out: higher seed (A) always wins -> J is champion.
    for (let ri = 0; ri < 3; ri++) {
      const v = (await getEventView(db, finale.id))!;
      for (const m of v.cut[ri]!.matches) {
        await opSetResult(
          db,
          admin,
          finale.id,
          { phase: "cut", round: ri, match: m.index, game: 1, result: "A" },
          rng,
        );
      }
    }
    view = (await getEventView(db, finale.id))!;
    expect(view.meta.status).toBe("DONE");
    const champ = await db.eventRecord.findFirstOrThrow({ where: { eventId: finale.id, champion: true } });
    expect(champ).toMatchObject({ playerName: "Player J", points: 20 });
    const played = await db.eventRecord.findMany({
      where: { eventId: finale.id, placing: { startsWith: "Rank" } },
    });
    expect(played.every((r) => r.points === 2)).toBe(true);

    // Doubled points count on the Month 2 and Season boards.
    const boards = (await getLiveBoards(db))!;
    expect(boards.boards.month2.rows[0]).toMatchObject({ name: "Player J", total: 30 }); // 10 (event 3) + 20
    expect(boards.boards.season.rows[0]).toMatchObject({ name: "Player J", total: 50 });
  });

  it("the finale flag can be set on any event before it starts", async () => {
    const s = await createSeason(db, admin, { name: "S", firstDate: "2026-01-03" });
    if (!s.ok) throw new Error();
    const e1 = await db.event.findFirstOrThrow({ where: { seasonId: s.seasonId, index: 1 } });
    const base = {
      name: "E1",
      date: "2026-01-03",
      month: "1",
      matchFormat: "SINGLE",
      swissRounds: "",
      cutSize: "4",
    };
    expect(await updateEventSetup(db, admin, e1.id, { ...base, finale: true })).toEqual({ ok: true });
    expect((await db.event.findUniqueOrThrow({ where: { id: e1.id } })).finale).toBe(true);
    await db.event.update({ where: { id: e1.id }, data: { status: "SWISS" } });
    expect(await updateEventSetup(db, admin, e1.id, { ...base, finale: false })).toMatchObject({ ok: false });
  });
});
