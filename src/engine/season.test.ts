import { describe, expect, it } from "vitest";
import { newEvent } from "./event";
import {
  addDays,
  eventChampion,
  eventsForBoard,
  monthTrophies,
  planSeason,
  seasonSnapshot,
  seasonTrophies,
  undefeatedInSwiss,
} from "./season";
import { byId, match, round } from "./test-helpers";
import type { EventState } from "./types";

const swiss = (id: string, month: 1 | 2, winner: string, loser: string): EventState =>
  newEvent({
    id,
    month,
    status: "done",
    cutSize: 0,
    entrants: [winner, loser],
    rounds: [round(match(winner, loser, "A"))],
  });

describe("season plan", () => {
  it("creates 4 events two weeks apart; events 1-2 are Month 1, 3-4 Month 2", () => {
    expect(planSeason("2026-10-10")).toEqual([
      { index: 1, name: "Event 1", date: "2026-10-10", month: 1, finale: false },
      { index: 2, name: "Event 2", date: "2026-10-24", month: 1, finale: false },
      { index: 3, name: "Event 3", date: "2026-11-07", month: 2, finale: false },
      { index: 4, name: "Event 4", date: "2026-11-21", month: 2, finale: true },
    ]);
  });

  it("date maths crosses months and years", () => {
    expect(addDays("2026-12-25", 14)).toBe("2027-01-08");
    expect(addDays("2028-02-20", 14)).toBe("2028-03-05");
  });
});

describe("season archive", () => {
  const events = [
    swiss("e1", 1, "a", "b"),
    swiss("e2", 1, "a", "c"),
    swiss("e3", 2, "b", "a"),
    swiss("e4", 2, "c", "b"),
  ];
  const names: Record<string, string> = { a: "Ada", b: "Bo", c: "Cy" };
  const nameOf = (id: string) => names[id]!;

  it("splits boards by month", () => {
    expect(eventsForBoard(events, "month1").map((e) => e.id)).toEqual(["e1", "e2"]);
    expect(eventsForBoard(events, "month2").map((e) => e.id)).toEqual(["e3", "e4"]);
    expect(eventsForBoard(events, "season")).toHaveLength(4);
  });

  it("snapshots every board with names and points", () => {
    const snap = seasonSnapshot(events, nameOf);
    expect(snap.month1.map((r) => [r.name, r.total, r.rank])).toEqual([
      ["Ada", 20, 1],
      ["Bo", 7, 2],
      ["Cy", 7, 2],
    ]);
    // Season: a 10+10+7 = 27, b 7+10+7 = 24, c 7+10 = 17.
    expect(snap.season.map((r) => [r.name, r.total, r.titles, r.played])).toEqual([
      ["Ada", 27, 2, 3],
      ["Bo", 24, 1, 3],
      ["Cy", 17, 1, 2],
    ]);
  });

  it("awards season podium trophies (shared ranks share the trophy)", () => {
    expect(
      seasonTrophies([
        { id: "a", rank: 1, total: 27 },
        { id: "b", rank: 2, total: 24 },
        { id: "c", rank: 2, total: 24 },
        { id: "d", rank: 4, total: 3 },
      ]),
    ).toEqual([
      { playerId: "a", kind: "season-champion" },
      { playerId: "b", kind: "season-second" },
      { playerId: "c", kind: "season-second" },
    ]);
  });
});

describe("event trophies and milestones", () => {
  it("event champion is the Champion placing of a finished event", () => {
    expect(eventChampion(swiss("e", 1, "w", "l"), byId)).toBe("w");
    expect(eventChampion({ ...swiss("e", 1, "w", "l"), status: "swiss" }, byId)).toBeNull();
  });

  it("undefeated Swiss: played at least one game and lost none (draws allowed, byes alone do not count)", () => {
    const ev = newEvent({
      id: "e",
      status: "done",
      cutSize: 0,
      entrants: ["a", "b", "c", "d", "e"],
      rounds: [round(match("a", "b", "A"), match("c", "d", "D"), match("e", null))],
    });
    expect(undefeatedInSwiss(ev, byId).sort()).toEqual(["a", "c", "d"]);
  });

  it("month champions: rank 1 of each month board with points", () => {
    const m1 = [
      { id: "a", rank: 1, total: 10 },
      { id: "b", rank: 1, total: 10 },
      { id: "c", rank: 3, total: 7 },
    ];
    const m2 = [{ id: "c", rank: 1, total: 0 }];
    expect(monthTrophies(m1, m2)).toEqual([
      { playerId: "a", kind: "month1-champion" },
      { playerId: "b", kind: "month1-champion" },
    ]);
  });
});
