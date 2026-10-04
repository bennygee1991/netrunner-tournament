import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { seededRng } from "@/engine";
import type { PrismaClient } from "@/generated/prisma/client";
import { hasTestDb, resetDb, testDb } from "../../../tests/test-db";
import { toIsoDate } from "./dates";
import { opFinish, opPairNext, opSetResult, opStartCut, opStartSwiss, runEventOp } from "./ops";
import { getEventView, getHomeData } from "./queries";
import {
  addPlayerByName,
  approveAllSignups,
  approveSignup,
  playerSignUp,
  playerWithdraw,
  rejectSignup,
  removeEntrant,
} from "./registration";
import { createSeason, readPrizes, updateEventSetup, updatePrizes } from "./season";
import { loadEvent } from "./state";

describe.skipIf(!hasTestDb)("tournament services (database)", () => {
  let db: PrismaClient;
  let admin: { id: string; runnerName: string };

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

  async function makeUsers(n: number) {
    const out = [];
    for (let i = 1; i <= n; i++) {
      out.push(
        await db.user.create({
          data: { runnerName: `Runner ${i}`, runnerNameLower: `runner ${i}`, passwordHash: "x" },
        }),
      );
    }
    return out;
  }

  async function newSeason() {
    const r = await createSeason(db, admin, { name: "Autumn", firstDate: "2026-10-10" });
    if (!r.ok) throw new Error(JSON.stringify(r));
    return db.event.findMany({ where: { seasonId: r.seasonId }, orderBy: { index: "asc" } });
  }

  describe("seasons", () => {
    it("creates 4 events two weeks apart with months 1,1,2,2 and logs it", async () => {
      const events = await newSeason();
      // League format: events 1-3 Swiss only (3 rounds), the finale adds a top 4 series cut.
      expect(
        events.map((e) => [
          e.name,
          toIsoDate(e.date),
          e.month,
          e.status,
          e.swissRounds,
          e.cutSize,
          e.cutFormat,
        ]),
      ).toEqual([
        ["Event 1", "2026-10-10", 1, "SIGNUP", 3, 0, "SINGLE"],
        ["Event 2", "2026-10-24", 1, "SIGNUP", 3, 0, "SINGLE"],
        ["Event 3", "2026-11-07", 2, "SIGNUP", 3, 0, "SINGLE"],
        ["Season finale", "2026-11-21", 2, "SIGNUP", 3, 4, "SERIES"],
      ]);
      expect(await db.auditLog.count({ where: { action: "season.create" } })).toBe(1);
    });

    it("allows only one active season", async () => {
      await newSeason();
      expect(await createSeason(db, admin, { name: "Two", firstDate: "2026-12-01" })).toMatchObject({
        ok: false,
      });
    });

    it("validates season input", async () => {
      expect(await createSeason(db, admin, { name: "", firstDate: "2026-02-30" })).toMatchObject({
        ok: false,
        fieldErrors: { name: expect.any(String), firstDate: expect.any(String) },
      });
    });

    it("event setup: format locks once started, name/date/month stay editable", async () => {
      const [e1] = await newSeason();
      const setup = {
        name: "Kickoff",
        date: "2026-10-11",
        month: "1",
        matchFormat: "DOUBLE",
        swissRounds: "3",
        cutSize: "8",
      };
      expect(await updateEventSetup(db, admin, e1!.id, setup)).toEqual({ ok: true });
      const saved = await db.event.findUniqueOrThrow({ where: { id: e1!.id } });
      expect(saved).toMatchObject({ name: "Kickoff", matchFormat: "DOUBLE", swissRounds: 3, cutSize: 8 });
      expect(await updateEventSetup(db, admin, e1!.id, { ...setup, swissRounds: "12" })).toMatchObject({
        ok: false,
      });
      expect(await updateEventSetup(db, admin, e1!.id, { ...setup, cutSize: "6" })).toMatchObject({
        ok: false,
      });
      expect(await updateEventSetup(db, admin, e1!.id, { ...setup, swissRounds: "" })).toEqual({ ok: true });

      await db.event.update({ where: { id: e1!.id }, data: { status: "SWISS" } });
      expect(
        await updateEventSetup(db, admin, e1!.id, { ...setup, swissRounds: "", cutSize: "4" }),
      ).toMatchObject({
        ok: false,
        error: expect.stringMatching(/before the event starts/),
      });
      expect(
        await updateEventSetup(db, admin, e1!.id, { ...setup, swissRounds: "", name: "Renamed" }),
      ).toEqual({ ok: true });
    });

    it("event time, venue and notes are optional, validated and clearable", async () => {
      const [e1] = await newSeason();
      const base = {
        name: "Event 1",
        date: "2026-10-10",
        month: "1",
        matchFormat: "SINGLE",
        swissRounds: "",
        cutSize: "4",
      };
      expect(
        await updateEventSetup(db, admin, e1!.id, {
          ...base,
          startTime: "18:30",
          venue: "The Hive",
          notes: "Bring sleeves",
        }),
      ).toEqual({ ok: true });
      expect(await db.event.findUniqueOrThrow({ where: { id: e1!.id } })).toMatchObject({
        startTime: "18:30",
        venue: "The Hive",
        notes: "Bring sleeves",
      });
      expect(await updateEventSetup(db, admin, e1!.id, { ...base, startTime: "25:00" })).toMatchObject({
        ok: false,
        fieldErrors: { startTime: expect.any(String) },
      });
      // Omitted fields are left alone; empty strings clear them.
      await updateEventSetup(db, admin, e1!.id, base);
      expect((await db.event.findUniqueOrThrow({ where: { id: e1!.id } })).venue).toBe("The Hive");
      await updateEventSetup(db, admin, e1!.id, { ...base, startTime: "", venue: "", notes: "" });
      expect(await db.event.findUniqueOrThrow({ where: { id: e1!.id } })).toMatchObject({
        startTime: null,
        venue: null,
        notes: null,
      });
      // Details can still be edited after the event starts.
      await db.event.update({ where: { id: e1!.id }, data: { status: "SWISS" } });
      expect(await updateEventSetup(db, admin, e1!.id, { ...base, venue: "Moved to the library" })).toEqual({
        ok: true,
      });
    });

    it("prizes are saved and audited", async () => {
      const [e1] = await newSeason();
      await updatePrizes(db, admin, e1!.seasonId, { month1: "Playmat", month2: "Alt art", season: "Trophy" });
      const s = await db.season.findUniqueOrThrow({ where: { id: e1!.seasonId } });
      expect(readPrizes(s.prizesJson)).toEqual({ month1: "Playmat", month2: "Alt art", season: "Trophy" });
      expect(await db.auditLog.count({ where: { action: "season.prizes" } })).toBe(1);
    });
  });

  describe("sign-ups and registrations", () => {
    it("players sign up and withdraw; admin approves, rejects and removes", async () => {
      const [e1] = await newSeason();
      const [u1, u2, u3] = await makeUsers(3);
      expect(await playerSignUp(db, u1!.id, e1!.id)).toMatchObject({ ok: true });
      expect(await playerSignUp(db, u1!.id, e1!.id)).toMatchObject({ ok: true }); // idempotent
      await playerSignUp(db, u2!.id, e1!.id);
      await playerSignUp(db, u3!.id, e1!.id);

      let view = (await getEventView(db, e1!.id))!;
      expect(view.pending.map((p) => p.runnerName)).toEqual(["Runner 1", "Runner 2", "Runner 3"]);

      expect(await approveSignup(db, admin, e1!.id, u1!.id)).toEqual({ ok: true });
      expect(await rejectSignup(db, admin, e1!.id, u3!.id)).toEqual({ ok: true });
      view = (await getEventView(db, e1!.id))!;
      expect(view.pending.map((p) => p.runnerName)).toEqual(["Runner 2"]);
      expect(view.entrants.map((e) => e.name)).toEqual(["Runner 1"]);

      expect(await approveAllSignups(db, admin, e1!.id)).toMatchObject({
        ok: true,
        message: "Approved 1 sign-up.",
      });
      view = (await getEventView(db, e1!.id))!;
      expect(view.entrants.map((e) => e.name)).toEqual(["Runner 1", "Runner 2"]);

      expect(await playerWithdraw(db, u2!.id, e1!.id)).toMatchObject({ ok: true });
      view = (await getEventView(db, e1!.id))!;
      expect(view.entrants.map((e) => e.name)).toEqual(["Runner 1"]);

      const entrant = view.entrants[0]!;
      expect(await removeEntrant(db, admin, e1!.id, entrant.id)).toEqual({ ok: true });
      expect(await db.signup.count({ where: { eventId: e1!.id } })).toBe(0);
    });

    it("home data lists open events, who signed up, and my sign-ups", async () => {
      const [e1] = await newSeason();
      const [u1] = await makeUsers(1);
      await playerSignUp(db, u1!.id, e1!.id);
      const home = (await getHomeData(db, u1!.id))!;
      expect(home.open).toHaveLength(4);
      expect(home.open[0]).toMatchObject({ signups: ["Runner 1"], mine: true });
      expect(home.open[1]).toMatchObject({ signups: [], mine: false });
      expect(home.next?.id).toBeDefined();
    });

    it("add player by name: accounts are linked, other names become guests, duplicates refused", async () => {
      const [e1] = await newSeason();
      await makeUsers(1);
      expect(await addPlayerByName(db, admin, e1!.id, "runner 1")).toMatchObject({
        ok: true,
        message: "Added Runner 1.",
      });
      expect(await addPlayerByName(db, admin, e1!.id, "Walk In")).toMatchObject({
        ok: true,
        message: "Added Walk In (walk-in guest).",
      });
      expect(await addPlayerByName(db, admin, e1!.id, "RUNNER 1")).toMatchObject({ ok: false });
      expect(await addPlayerByName(db, admin, e1!.id, "walk in")).toMatchObject({ ok: false });
      expect(await addPlayerByName(db, admin, e1!.id, "!")).toMatchObject({ ok: false });
      const entrants = await db.entrant.findMany({ where: { eventId: e1!.id } });
      expect(entrants.map((e) => [!!e.userId, e.guestName])).toEqual([
        [true, null],
        [false, "Walk In"],
      ]);
    });

    it("sign-ups close once the event starts", async () => {
      const [e1] = await newSeason();
      const [u1, u2, u3] = await makeUsers(3);
      await addPlayerByName(db, admin, e1!.id, "Runner 1");
      await addPlayerByName(db, admin, e1!.id, "Runner 2");
      await opStartSwiss(db, admin, e1!.id, seededRng(1));
      expect(await playerSignUp(db, u3!.id, e1!.id)).toMatchObject({
        ok: false,
        error: expect.stringMatching(/closed/),
      });
      expect(await playerWithdraw(db, u1!.id, e1!.id)).toMatchObject({ ok: false });
      expect(
        await removeEntrant(
          db,
          admin,
          e1!.id,
          (await db.entrant.findFirstOrThrow({ where: { userId: u2!.id } })).id,
        ),
      ).toMatchObject({
        ok: false,
      });
    });
  });

  describe("running an event", () => {
    it("runs a 6-player event with a top 4 cut end to end and writes records and trophies", async () => {
      const [e1] = await newSeason();
      // Classic setup: automatic Swiss rounds and a single-game top 4 cut.
      await db.event.update({ where: { id: e1!.id }, data: { swissRounds: null, cutSize: 4 } });
      await makeUsers(5);
      for (let i = 1; i <= 5; i++) await addPlayerByName(db, admin, e1!.id, `Runner ${i}`);
      await addPlayerByName(db, admin, e1!.id, "Guest Gary");
      const rng = seededRng(42);

      expect(await opStartSwiss(db, admin, e1!.id, rng)).toMatchObject({ ok: true });
      let view = (await getEventView(db, e1!.id))!;
      expect(view.meta).toMatchObject({ status: "SWISS", swissRounds: 5, cutSize: 4 });
      expect(view.swiss[0]!.matches).toHaveLength(3);
      expect(view.swiss[0]!.matches.every((m) => m.corpId)).toBe(true);

      const reportRound = async () => {
        const v = (await getEventView(db, e1!.id))!;
        const r = v.swiss.at(-1)!;
        for (const m of r.matches) {
          if (!m.b) continue;
          const res = await opSetResult(
            db,
            admin,
            e1!.id,
            { phase: "swiss", round: r.index, match: m.index, game: 1, result: "A" },
            rng,
          );
          expect(res.ok).toBe(true);
        }
      };

      await reportRound();
      for (let round = 2; round <= 5; round++) {
        expect(await opPairNext(db, admin, e1!.id, rng)).toMatchObject({ ok: true });
        await reportRound();
      }
      expect(await opPairNext(db, admin, e1!.id, rng)).toMatchObject({ ok: false });
      expect(await opFinish(db, admin, e1!.id)).toMatchObject({ ok: false }); // has a cut
      expect(await opStartCut(db, admin, e1!.id, rng)).toMatchObject({ ok: true });

      view = (await getEventView(db, e1!.id))!;
      expect(view.cut[0]!.label).toBe("Semifinals");
      for (const m of view.cut[0]!.matches) {
        await opSetResult(
          db,
          admin,
          e1!.id,
          { phase: "cut", round: 0, match: m.index, game: 1, result: "A" },
          rng,
        );
      }
      view = (await getEventView(db, e1!.id))!;
      expect(view.cut[1]!.label).toBe("Final");
      await opSetResult(db, admin, e1!.id, { phase: "cut", round: 1, match: 0, game: 1, result: "B" }, rng);

      view = (await getEventView(db, e1!.id))!;
      expect(view.meta.status).toBe("DONE");
      const champion = view.cut[1]!.matches[0]!.b!.name;

      const records = await db.eventRecord.findMany({ where: { eventId: e1!.id }, orderBy: { rank: "asc" } });
      expect(records).toHaveLength(6);
      expect(records[0]).toMatchObject({
        playerName: champion,
        placing: "Champion",
        points: 10,
        champion: true,
      });
      expect(records.filter((r) => r.placing === "Top 4")).toHaveLength(2);
      expect(records.find((r) => r.playerName === "Guest Gary")).toMatchObject({ userId: null });
      const trophies = await db.trophy.findMany();
      expect(trophies).toEqual([
        expect.objectContaining({ kind: "event-champion", playerName: champion, seasonName: "Autumn" }),
      ]);

      const actions = (await db.auditLog.findMany({ select: { action: true } })).map((a) => a.action);
      expect(actions).toEqual(
        expect.arrayContaining(["event.start_swiss", "event.pair_round", "event.result", "event.start_cut"]),
      );
    });

    it("double-sided events need both games and store game 2", async () => {
      const [e1] = await newSeason();
      await updateEventSetup(db, admin, e1!.id, {
        name: "DS",
        date: "2026-10-10",
        month: "1",
        matchFormat: "DOUBLE",
        swissRounds: "1",
        cutSize: "0",
      });
      await addPlayerByName(db, admin, e1!.id, "Alpha Guest");
      await addPlayerByName(db, admin, e1!.id, "Beta Guest");
      const rng = seededRng(5);
      await opStartSwiss(db, admin, e1!.id, rng);
      await opSetResult(db, admin, e1!.id, { phase: "swiss", round: 0, match: 0, game: 1, result: "A" }, rng);
      expect(await opFinish(db, admin, e1!.id)).toMatchObject({ ok: false });
      await opSetResult(db, admin, e1!.id, { phase: "swiss", round: 0, match: 0, game: 2, result: "D" }, rng);
      expect(await opFinish(db, admin, e1!.id)).toMatchObject({ ok: true });
      const m = await db.match.findFirstOrThrow();
      expect([m.result1, m.result2]).toEqual(["A", "D"]);
      const loaded = await loadEvent(db, e1!.id);
      expect(loaded.state.rounds[0]!.matches[0]).toMatchObject({ g1: "A", g2: "D" });
    });

    it("a late approval during Swiss joins the next pairing", async () => {
      const [e1] = await newSeason();
      const [, , , u4] = await makeUsers(4);
      for (let i = 1; i <= 3; i++) await addPlayerByName(db, admin, e1!.id, `Runner ${i}`);
      const rng = seededRng(8);
      await opStartSwiss(db, admin, e1!.id, rng);
      await db.signup.create({ data: { eventId: e1!.id, userId: u4!.id } });
      expect(await approveSignup(db, admin, e1!.id, u4!.id)).toEqual({ ok: true });
      const v = (await getEventView(db, e1!.id))!;
      for (const m of v.swiss[0]!.matches) {
        if (m.b)
          await opSetResult(
            db,
            admin,
            e1!.id,
            { phase: "swiss", round: 0, match: m.index, game: 1, result: "A" },
            rng,
          );
      }
      await opPairNext(db, admin, e1!.id, rng);
      const v2 = (await getEventView(db, e1!.id))!;
      const names = v2.swiss[1]!.matches.flatMap((m) => [m.a.name, m.b?.name]);
      expect(names).toContain("Runner 4");
    });

    it("rejects stale writes from another tab (version check)", async () => {
      const [e1] = await newSeason();
      await addPlayerByName(db, admin, e1!.id, "Alpha Guest");
      await addPlayerByName(db, admin, e1!.id, "Beta Guest");
      const res = await runEventOp(db, admin, e1!.id, "test", (l) => {
        // Simulate another admin changing the event between load and save.
        return { ...l.state, status: "swiss" };
      });
      expect(res.ok).toBe(true);
      const before = await db.event.findUniqueOrThrow({ where: { id: e1!.id } });
      await expect(
        db.$transaction(async (tx) => {
          const { saveEvent } = await import("./state");
          await saveEvent(tx, e1!.id, before.version - 1, (await loadEvent(tx, e1!.id)).state);
        }),
      ).rejects.toThrow(/changed elsewhere/);
    });

    it("refuses actions from a stale page", async () => {
      const [e1] = await newSeason();
      await addPlayerByName(db, admin, e1!.id, "Alpha Guest");
      await addPlayerByName(db, admin, e1!.id, "Beta Guest");
      const ev = await db.event.findUniqueOrThrow({ where: { id: e1!.id } });
      expect(await opStartSwiss(db, admin, e1!.id, seededRng(1), ev.version - 1)).toMatchObject({
        ok: false,
        error: expect.stringMatching(/changed elsewhere/),
      });
      expect(await opStartSwiss(db, admin, e1!.id, seededRng(1), ev.version)).toMatchObject({ ok: true });
      const m = (await loadEvent(db, e1!.id)).state.rounds[0]!.matches[0]!;
      const base = { phase: "swiss", round: 0, match: 0, game: 1, result: "A" };
      expect(await opSetResult(db, admin, e1!.id, { ...base, a: m.b, b: m.a }, seededRng(1))).toMatchObject({
        ok: false,
      });
      expect(await opSetResult(db, admin, e1!.id, { ...base, a: m.a, b: m.b }, seededRng(1))).toMatchObject({
        ok: true,
      });
    });

    it("invalid result input is rejected", async () => {
      const [e1] = await newSeason();
      expect(
        await opSetResult(
          db,
          admin,
          e1!.id,
          { phase: "swiss", round: -1, match: 0, game: 1, result: "A" },
          seededRng(1),
        ),
      ).toMatchObject({
        ok: false,
        error: "Invalid result.",
      });
      expect(
        await opSetResult(
          db,
          admin,
          e1!.id,
          { phase: "swiss", round: 0, match: 0, game: 3, result: "A" },
          seededRng(1),
        ),
      ).toMatchObject({
        ok: false,
      });
      expect(await opStartSwiss(db, admin, "nope", seededRng(1))).toEqual({
        ok: false,
        error: "Event not found.",
      });
    });
  });
});
