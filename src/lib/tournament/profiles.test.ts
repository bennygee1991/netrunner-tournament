import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { seededRng } from "@/engine";
import type { PrismaClient } from "@/generated/prisma/client";
import { hasTestDb, resetDb, testDb } from "../../../tests/test-db";
import { updateProfile } from "../auth/accounts";
import { getLiveBoards, getPastSeasons } from "./leaderboards";
import { opFinish, opPairNext, opSetResult, opStartSwiss } from "./ops";
import { getProfile } from "./profiles";
import { addPlayerByName } from "./registration";
import { archiveSeason } from "./resets";
import { createSeason, updateEventSetup, updatePrizes } from "./season";
import { loadEvent } from "./state";

describe.skipIf(!hasTestDb)("leaderboards and profiles (database)", () => {
  let db: PrismaClient;
  let admin: { id: string; runnerName: string };
  const rng = seededRng(3);

  beforeAll(() => {
    db = testDb();
  });
  beforeEach(async () => {
    await resetDb(db);
    const a = await db.user.create({
      data: { runnerName: "Org", runnerNameLower: "org", passwordHash: "x", role: "ADMIN" },
    });
    admin = { id: a.id, runnerName: a.runnerName };
  });
  afterAll(() => db.$disconnect());

  /** Runs a 2-round Swiss-only event where `winner` wins every game (if paired as A, else B). */
  async function playEvent(eventId: string, players: string[], winner: string) {
    const ev = await db.event.findUniqueOrThrow({ where: { id: eventId } });
    await updateEventSetup(db, admin, eventId, {
      name: ev.name,
      date: ev.date.toISOString().slice(0, 10),
      month: String(ev.month),
      matchFormat: "SINGLE",
      swissRounds: "2",
      cutSize: "0",
    });
    for (const p of players) {
      const added = await addPlayerByName(db, admin, eventId, p);
      if (!added.ok) throw new Error(`add ${p}: ${added.error}`);
    }
    const started = await opStartSwiss(db, admin, eventId, rng);
    if (!started.ok) throw new Error(`start: ${started.error}`);
    for (let round = 0; round < 2; round++) {
      if (round > 0) {
        const p = await opPairNext(db, admin, eventId, rng);
        if (!p.ok) throw new Error(`pair: ${p.error}`);
      }
      const l = await loadEvent(db, eventId);
      for (const [mi, m] of l.state.rounds[round]!.matches.entries()) {
        if (!m.b) continue;
        const result = l.nameOf(m.b) === winner ? "B" : "A";
        await opSetResult(db, admin, eventId, { phase: "swiss", round, match: mi, game: 1, result }, rng);
      }
    }
    const r = await opFinish(db, admin, eventId);
    if (!r.ok) throw new Error(r.error);
  }

  it("live boards split by month, carry prizes, link accounts and sort by points", async () => {
    const s = await createSeason(db, admin, { name: "S", firstDate: "2026-01-03" });
    if (!s.ok) throw new Error();
    await updatePrizes(db, admin, s.seasonId, { month1: "Mat", month2: "Sleeves", season: "Cup" });
    const kate = await db.user.create({
      data: { runnerName: "Kate", runnerNameLower: "kate", passwordHash: "x" },
    });
    const events = await db.event.findMany({ where: { seasonId: s.seasonId }, orderBy: { index: "asc" } });
    await playEvent(events[0]!.id, ["Kate", "Gabe", "Noise", "Whiz"], "Kate");
    await playEvent(events[2]!.id, ["Kate", "Gabe", "Noise", "Whiz"], "Gabe");

    const live = (await getLiveBoards(db))!;
    expect(live.boards.month1).toMatchObject({ prize: "Mat", eventsDone: 1, eventsTotal: 2 });
    expect(live.boards.month1.columns.map((c) => c.label)).toEqual(["E1", "E2"]);
    expect(live.boards.month1.rows[0]).toMatchObject({
      name: "Kate",
      profile: "Kate",
      total: 10,
      titles: 1,
      cells: [10, null],
    });
    expect(live.boards.month1.rows.find((r) => r.name === "Gabe")!.profile).toBeNull(); // walk-in
    expect(live.boards.month2.rows[0]).toMatchObject({ name: "Gabe", total: 10 });
    expect(live.boards.season.columns.map((c) => c.label)).toEqual(["M1", "M2"]);
    const kateSeason = live.boards.season.rows.find((r) => r.name === "Kate")!;
    expect(kateSeason.cells[0]).toBe(10);
    expect(kateSeason.total).toBe(kateSeason.cells.reduce<number>((t, c) => t + (c ?? 0), 0));

    const profile = (await getProfile(db, "KATE"))!;
    expect(profile.user.id).toBe(kate.id);
    expect(profile.stats).toMatchObject({ events: 2, titles: 1 });
    expect(profile.standing).toMatchObject({ seasonName: "S", total: kateSeason.total });
    expect(profile.cabinet.map((t) => t.kind)).toEqual(
      expect.arrayContaining(["event-champion", "first-event", "undefeated-swiss"]),
    );
    expect(profile.records.map((r) => r.eventName)).toEqual(["Event 3", "Event 1"]);
  });

  it("past seasons keep frozen boards and podium trophies appear on profiles", async () => {
    const s = await createSeason(db, admin, { name: "Old", firstDate: "2025-01-04" });
    if (!s.ok) throw new Error();
    await updatePrizes(db, admin, s.seasonId, { month1: "", month2: "", season: "Big cup" });
    await db.user.create({ data: { runnerName: "Ada", runnerNameLower: "ada", passwordHash: "x" } });
    const events = await db.event.findMany({ where: { seasonId: s.seasonId }, orderBy: { index: "asc" } });
    await playEvent(events[0]!.id, ["Ada", "Bob", "Cyd"], "Ada");
    await archiveSeason(db, admin, s.seasonId, "Old");
    await db.user.update({
      where: { runnerNameLower: "ada" },
      data: { runnerName: "Ada Lovelace", runnerNameLower: "ada lovelace" },
    });

    const past = await getPastSeasons(db);
    expect(past).toHaveLength(1);
    expect(past[0]!.boards.season!.prize).toBe("Big cup");
    const top = past[0]!.boards.season!.rows[0]!;
    expect(top).toMatchObject({ name: "Ada", rank: 1, profile: "Ada Lovelace" });

    const profile = (await getProfile(db, "Ada Lovelace"))!;
    expect(profile.cabinet[0]).toMatchObject({ kind: "season-champion", detail: "Old" });
    expect(profile.standing).toBeNull();
    expect(await getProfile(db, "Ada")).toBeNull();
  });

  it("disabled accounts have no public profile; bios are saved and cleaned", async () => {
    const u = await db.user.create({
      data: { runnerName: "Shy", runnerNameLower: "shy", passwordHash: "x" },
    });
    expect(
      await updateProfile(db, u.id, { theme: "system", email: "", bio: "  Shaper main\u0007  " }),
    ).toEqual({ ok: true });
    expect((await getProfile(db, "shy"))!.user.bio).toBe("Shaper main");
    expect((await updateProfile(db, u.id, { theme: "system", email: "", bio: "x".repeat(281) })).ok).toBe(
      false,
    );
    await db.user.update({ where: { id: u.id }, data: { disabledAt: new Date() } });
    expect(await getProfile(db, "shy")).toBeNull();
  });
});
