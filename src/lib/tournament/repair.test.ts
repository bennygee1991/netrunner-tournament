import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { seededRng } from "@/engine";
import type { PrismaClient } from "@/generated/prisma/client";
import { hasTestDb, resetDb, testDb } from "../../../tests/test-db";
import { seasonBoards } from "./boards";
import {
  opDrop,
  opFinish,
  opPairNext,
  opReopen,
  opResetEvent,
  opRestartRound,
  opSetResult,
  opStartCut,
  opStartSwiss,
  opUndoRound,
  opUndrop,
} from "./ops";
import { addPlayerByName, linkGuestToAccount } from "./registration";
import { archiveSeason, resetEverything } from "./resets";
import { createSeason, updateEventSetup } from "./season";
import { loadEvent } from "./state";

describe.skipIf(!hasTestDb)("repair tools and resets (database)", () => {
  let db: PrismaClient;
  let admin: { id: string; runnerName: string };
  const rng = seededRng(77);

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

  async function season(name = "Spring") {
    const r = await createSeason(db, admin, { name, firstDate: "2026-03-07" });
    if (!r.ok) throw new Error("season");
    return {
      seasonId: r.seasonId,
      events: await db.event.findMany({ where: { seasonId: r.seasonId }, orderBy: { index: "asc" } }),
    };
  }

  async function setup(eventId: string, players: string[], opts: { rounds?: string; cut?: string } = {}) {
    const ev = await db.event.findUniqueOrThrow({ where: { id: eventId } });
    await updateEventSetup(db, admin, eventId, {
      name: ev.name,
      date: ev.date.toISOString().slice(0, 10),
      month: String(ev.month),
      matchFormat: "SINGLE",
      swissRounds: opts.rounds ?? "2",
      cutSize: opts.cut ?? "0",
    });
    for (const p of players) await addPlayerByName(db, admin, eventId, p);
  }

  async function reportCurrent(eventId: string, result: "A" | "B" = "A") {
    const { state } = await loadEvent(db, eventId);
    const phase = state.status === "cut" ? "cut" : "swiss";
    const rounds = phase === "cut" ? state.cut : state.rounds;
    const ri = rounds.length - 1;
    for (const [mi, m] of rounds[ri]!.matches.entries()) {
      if (m.b === null) continue;
      const r = await opSetResult(db, admin, eventId, { phase, round: ri, match: mi, game: 1, result }, rng);
      if (!r.ok) throw new Error(r.error);
    }
  }

  async function runSwissOnly(eventId: string) {
    await opStartSwiss(db, admin, eventId, rng);
    await reportCurrent(eventId);
    await opPairNext(db, admin, eventId, rng);
    await reportCurrent(eventId);
    const r = await opFinish(db, admin, eventId);
    if (!r.ok) throw new Error(r.error);
  }

  const names = (n: number, prefix = "Guest") =>
    Array.from({ length: n }, (_, i) => `${prefix} ${String.fromCharCode(65 + i)}`);

  it("restart round re-pairs with late adds and without drops, discarding results", async () => {
    const { events } = await season();
    const id = events[0]!.id;
    await setup(id, names(4));
    await opStartSwiss(db, admin, id, rng);
    await reportCurrent(id);
    await opPairNext(db, admin, id, rng);
    await opSetResult(db, admin, id, { phase: "swiss", round: 1, match: 0, game: 1, result: "A" }, rng);

    await addPlayerByName(db, admin, id, "Late Larry");
    const before = await loadEvent(db, id);
    const dropId = before.entrants.find((e) => e.name === "Guest A")!.id;
    expect(await opDrop(db, admin, id, dropId)).toMatchObject({ ok: true });
    expect(await opRestartRound(db, admin, id, "swiss", rng)).toMatchObject({ ok: true });

    const after = await loadEvent(db, id);
    expect(after.state.rounds).toHaveLength(2);
    const r2 = after.state.rounds[1]!.matches;
    const ids = r2.flatMap((m) => [m.a, m.b]);
    expect(ids).not.toContain(dropId);
    expect(ids.map((x) => x && after.nameOf(x))).toContain("Late Larry");
    expect(r2.every((m) => m.b === null || m.g1 === null)).toBe(true);
    expect(after.entrants.find((e) => e.id === dropId)!.dropped).toBe(true);
    expect(await db.auditLog.count({ where: { action: "event.restart_round" } })).toBe(1);
  });

  it("drop and undrop are saved and audited; finished events must be reopened first", async () => {
    const { events } = await season();
    const id = events[0]!.id;
    await setup(id, names(4));
    await opStartSwiss(db, admin, id, rng);
    const e = (await loadEvent(db, id)).entrants[0]!;
    await opDrop(db, admin, id, e.id);
    expect((await db.entrant.findUniqueOrThrow({ where: { id: e.id } })).dropped).toBe(true);
    await opUndrop(db, admin, id, e.id);
    expect((await db.entrant.findUniqueOrThrow({ where: { id: e.id } })).dropped).toBe(false);
    expect(await opDrop(db, admin, id, "nope")).toMatchObject({ ok: false, error: "Entrant not found." });
    expect(await db.auditLog.count({ where: { action: { in: ["event.drop", "event.undrop"] } } })).toBe(2);
  });

  it("repair: an earlier round's result can be corrected; pairings stay and standings follow", async () => {
    const { events } = await season();
    const id = events[0]!.id;
    await setup(id, names(4), { rounds: "3" });
    await opStartSwiss(db, admin, id, rng);
    await reportCurrent(id, "A");
    await opPairNext(db, admin, id, rng);
    const before = await loadEvent(db, id);
    const pairings = before.state.rounds.map((r) => r.matches.map((m) => [m.a, m.b]));
    expect(
      await opSetResult(db, admin, id, { phase: "swiss", round: 0, match: 0, game: 1, result: "B" }, rng),
    ).toMatchObject({ ok: true });
    const after = await loadEvent(db, id);
    expect(after.state.rounds.map((r) => r.matches.map((m) => [m.a, m.b]))).toEqual(pairings);
    expect(after.state.rounds[0]!.matches[0]!.g1).toBe("B");
    const log = await db.auditLog.findFirstOrThrow({
      where: { action: "event.result" },
      orderBy: { createdAt: "desc" },
    });
    expect(log.detailJson).toMatchObject({ round: 1, resultBefore: "A", resultAfter: "B" });
  });

  it("undo round, reopen and reset event keep records in step", async () => {
    const { events } = await season();
    const id = events[0]!.id;
    await setup(id, names(4));
    await runSwissOnly(id);
    expect(await db.eventRecord.count({ where: { eventId: id } })).toBe(4);
    expect(await db.trophy.count({ where: { eventId: id } })).toBe(1);

    expect(await opReopen(db, admin, id)).toMatchObject({ ok: true });
    expect(await db.eventRecord.count({ where: { eventId: id } })).toBe(0);
    expect(await db.trophy.count({ where: { eventId: id } })).toBe(0);

    expect(await opUndoRound(db, admin, id, "swiss")).toMatchObject({ ok: true });
    expect((await loadEvent(db, id)).state.rounds).toHaveLength(1);

    expect(await opResetEvent(db, admin, id, "wrong")).toMatchObject({
      ok: false,
      error: expect.stringMatching(/Type the event name/),
    });
    expect(await opResetEvent(db, admin, id, "Event 1")).toMatchObject({ ok: true });
    const reset = await loadEvent(db, id);
    expect(reset.state).toMatchObject({ status: "signup", rounds: [], cut: [] });
    expect(reset.entrants).toHaveLength(4);
  });

  it("cut: restart and undo rounds", async () => {
    const { events } = await season();
    const id = events[0]!.id;
    await setup(id, names(8), { rounds: "1", cut: "8" });
    await opStartSwiss(db, admin, id, rng);
    await reportCurrent(id);
    await opStartCut(db, admin, id, rng);
    await reportCurrent(id); // quarterfinals -> semis paired
    expect((await loadEvent(db, id)).state.cut).toHaveLength(2);
    expect(await opRestartRound(db, admin, id, "cut", rng)).toMatchObject({ ok: true });
    expect((await loadEvent(db, id)).state.cut).toHaveLength(2);
    expect(await opUndoRound(db, admin, id, "cut")).toMatchObject({ ok: true });
    expect(await opUndoRound(db, admin, id, "cut")).toMatchObject({ ok: true });
    expect((await loadEvent(db, id)).state).toMatchObject({ status: "swiss", cut: [] });
    expect(await opRestartRound(db, admin, id, "bogus", rng)).toMatchObject({ ok: false });
  });

  it("archive season: snapshots boards with prizes, awards podium trophies, clears events, keeps accounts and records", async () => {
    const { seasonId, events } = await season("Summer");
    await db.season.update({
      where: { id: seasonId },
      data: { prizesJson: { month1: "Mat", month2: "", season: "Cup" } },
    });
    const user = await db.user.create({
      data: { runnerName: "Champ", runnerNameLower: "champ", passwordHash: "x" },
    });
    await setup(events[0]!.id, ["Champ", ...names(3)]);
    await runSwissOnly(events[0]!.id);
    const boards = await seasonBoards(db, seasonId);
    expect(boards.boards.season.length).toBe(4);

    expect(await archiveSeason(db, admin, seasonId, "summer")).toMatchObject({ ok: false });
    expect(await archiveSeason(db, admin, seasonId, "Summer")).toMatchObject({ ok: true });

    const s = await db.season.findUniqueOrThrow({ where: { id: seasonId } });
    expect(s.status).toBe("ARCHIVED");
    expect(await db.event.count()).toBe(0);
    expect(await db.entrant.count()).toBe(0);
    const snaps = await db.leaderboardSnapshot.findMany({ where: { seasonId } });
    expect(snaps.map((x) => x.boardKey).sort()).toEqual(["month1", "month2", "season"]);
    const seasonSnap = snaps.find((x) => x.boardKey === "season")!.rowsJson as {
      prize: string;
      rows: { name: string; total: number }[];
    };
    expect(seasonSnap.prize).toBe("Cup");
    expect(seasonSnap.rows).toHaveLength(4);
    const podium = await db.trophy.findMany({ where: { kind: { startsWith: "season-" } } });
    expect(podium.length).toBeGreaterThanOrEqual(3);
    expect(await db.user.findUnique({ where: { id: user.id } })).not.toBeNull();
    expect(await db.eventRecord.count()).toBe(4);
    expect((await db.eventRecord.findFirstOrThrow()).eventId).toBeNull();
    expect(await archiveSeason(db, admin, seasonId, "Summer")).toMatchObject({ ok: false });
    // A new season can now be created.
    expect((await createSeason(db, admin, { name: "Autumn", firstDate: "2026-09-05" })).ok).toBe(true);
  });

  it("reset everything wipes league data, keeps accounts unless asked, and keeps the audit log", async () => {
    const { events } = await season();
    await db.user.create({ data: { runnerName: "Player", runnerNameLower: "player", passwordHash: "x" } });
    await setup(events[0]!.id, ["Player", ...names(3)]);
    await runSwissOnly(events[0]!.id);

    expect(await resetEverything(db, admin, "reset", false)).toMatchObject({ ok: false });
    expect(await resetEverything(db, admin, "RESET", false)).toMatchObject({ ok: true });
    expect(await db.season.count()).toBe(0);
    expect(await db.event.count()).toBe(0);
    expect(await db.eventRecord.count()).toBe(0);
    expect(await db.trophy.count()).toBe(0);
    expect(await db.user.count()).toBe(2);

    expect(await resetEverything(db, admin, "RESET", true)).toMatchObject({ ok: true });
    expect(await db.user.findMany({ select: { runnerName: true } })).toEqual([{ runnerName: "Org" }]);
    expect(await db.auditLog.count({ where: { action: "system.reset_all" } })).toBe(2);
  });

  it("links a walk-in guest's entries, records and trophies to an account", async () => {
    const { events } = await season();
    await setup(events[0]!.id, ["Wally Walkin", ...names(3)]);
    await runSwissOnly(events[0]!.id);
    await setup(events[1]!.id, ["wally walkin", ...names(1)]);
    const user = await db.user.create({
      data: { runnerName: "Wally", runnerNameLower: "wally", passwordHash: "x" },
    });

    expect(await linkGuestToAccount(db, admin, "Nobody Here", user.id)).toMatchObject({ ok: false });
    const res = await linkGuestToAccount(db, admin, "Wally Walkin", user.id);
    expect(res).toMatchObject({
      ok: true,
      message: expect.stringMatching(/Linked 2 event entries and 1 result record/),
    });
    expect(await db.entrant.count({ where: { userId: user.id } })).toBe(2);
    expect(
      await db.entrant.count({
        where: { guestName: { not: null }, AND: { guestName: { contains: "alkin" } } },
      }),
    ).toBe(0);
    expect(await db.eventRecord.findFirstOrThrow({ where: { userId: user.id } })).toMatchObject({
      playerName: "Wally",
    });
    const loaded = await loadEvent(db, events[0]!.id);
    expect(loaded.entrants.map((e) => e.name)).toContain("Wally");
  });
});
