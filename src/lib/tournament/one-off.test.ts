import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { seededRng } from "@/engine";
import type { PrismaClient } from "@/generated/prisma/client";
import { hasTestDb, resetDb, testDb } from "../../../tests/test-db";
import { loadBadges } from "./badges";
import { seasonBoards } from "./boards";
import { getHallOfChampions } from "./community";
import { createOneOffEvent, deleteOneOffEvent, listOneOffEvents } from "./one-off";
import { opFinish, opSetResult, opStartSwiss } from "./ops";
import { getEventView } from "./queries";
import { addPlayerByName, playerSignUp } from "./registration";
import { resetEverything } from "./resets";
import { createSeason } from "./season";
import { loadEvent } from "./state";

describe.skipIf(!hasTestDb)("one-off events (database)", () => {
  let db: PrismaClient;
  let admin: { id: string; runnerName: string };
  const rng = seededRng(5);

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

  const create = (over: Record<string, string> = {}) =>
    createOneOffEvent(db, admin, {
      name: "Store championship",
      date: "2026-12-05",
      matchFormat: "DOUBLE",
      swissRounds: "1",
      cutSize: "0",
      cutFormat: "SERIES",
      ...over,
    });

  it("validates and creates an event outside any season, with sign-ups even without a season", async () => {
    expect(await create({ name: "" })).toMatchObject({
      ok: false,
      fieldErrors: { name: expect.any(String) },
    });
    expect(await create({ matchFormat: "TRIPLE" })).toMatchObject({ ok: false });
    const r = await create();
    if (!r.ok) throw new Error();
    const ev = await db.event.findUniqueOrThrow({ where: { id: r.eventId } });
    expect(ev).toMatchObject({ seasonId: null, matchFormat: "DOUBLE", swissRounds: 1, cutSize: 0 });
    expect(await db.auditLog.count({ where: { action: "event.create_one_off" } })).toBe(1);

    const u = await db.user.create({
      data: { runnerName: "Ann", runnerNameLower: "ann", passwordHash: "x" },
    });
    expect(await playerSignUp(db, u.id, r.eventId)).toMatchObject({ ok: true });
    expect((await listOneOffEvents(db)).upcoming.map((e) => e.id)).toEqual([r.eventId]);
    const view = (await getEventView(db, r.eventId))!;
    expect(view.meta).toMatchObject({ oneOff: true, seasonName: "One-off", seasonActive: true });
  });

  it("finishes with no league points, a one-off trophy and one-off badges, and stays off the boards", async () => {
    const s = await createSeason(db, admin, { name: "S", firstDate: "2026-12-05" });
    if (!s.ok) throw new Error();
    const r = await create();
    if (!r.ok) throw new Error();
    for (const n of ["Ann", "Ben"]) {
      await db.user.create({ data: { runnerName: n, runnerNameLower: n.toLowerCase(), passwordHash: "x" } });
      await addPlayerByName(db, admin, r.eventId, n);
    }
    await opStartSwiss(db, admin, r.eventId, rng);
    for (const game of [1, 2] as const)
      await opSetResult(db, admin, r.eventId, { phase: "swiss", round: 0, match: 0, game, result: "A" }, rng);
    expect(await opFinish(db, admin, r.eventId)).toMatchObject({ ok: true });

    const l = await loadEvent(db, r.eventId);
    const winner = l.nameOf(l.state.rounds[0]!.matches[0]!.a);
    const records = await db.eventRecord.findMany({ where: { eventKey: r.eventId } });
    expect(records.every((x) => x.oneOff && x.points === 0 && x.seasonId === null)).toBe(true);
    expect(
      await db.trophy.findMany({ where: { eventId: r.eventId }, select: { kind: true, playerName: true } }),
    ).toEqual([{ kind: "oneoff-champion", playerName: winner }]);
    const { boards } = await seasonBoards(db, s.seasonId);
    expect(boards.season).toHaveLength(0);

    const badges = await loadBadges(db);
    const ann = await db.user.findUniqueOrThrow({ where: { runnerNameLower: "ann" } });
    const keys = badges.byUser.get(ann.id)!.map((b) => b.key);
    expect(keys).toContain("wildcard");
    expect(keys).not.toContain("first-event");
    const hall = await getHallOfChampions(db);
    expect(hall.oneOffChampions.map((c) => c.player.name)).toEqual([winner]);
    expect(hall.eventChampions).toHaveLength(0);
  });

  it("deleting removes the event and its results; season events cannot be deleted; reset-all removes one-offs", async () => {
    const r = await create();
    if (!r.ok) throw new Error();
    expect(await deleteOneOffEvent(db, admin, "no-such-event")).toMatchObject({ ok: false });
    expect(await deleteOneOffEvent(db, admin, r.eventId)).toMatchObject({ ok: true });
    expect(await db.event.count()).toBe(0);
    expect(await db.auditLog.count({ where: { action: "event.delete_one_off" } })).toBe(1);

    const s = await createSeason(db, admin, { name: "S", firstDate: "2026-12-05" });
    if (!s.ok) throw new Error();
    const seasonEvent = await db.event.findFirstOrThrow({ where: { seasonId: s.seasonId } });
    expect(await deleteOneOffEvent(db, admin, seasonEvent.id)).toMatchObject({ ok: false });

    await create();
    expect(await resetEverything(db, admin, "RESET", false)).toMatchObject({ ok: true });
    expect(await db.event.count()).toBe(0);
  });
});
