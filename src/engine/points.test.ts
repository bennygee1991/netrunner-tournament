import { describe, expect, it } from "vitest";
import { newEvent } from "./event";
import { eventResults, leaderboard } from "./points";
import { pointsForSwissRank } from "./rules";
import { byId, match, players, round } from "./test-helpers";
import type { EventState } from "./types";

function finishedCutEvent(id = "e", month: 1 | 2 = 1): EventState {
  // Swiss: p01..p04 beat p05..p08. Top 8 cut: QF winners p01, p04, p02, p03; SF p01, p02; final p01.
  return newEvent({
    id,
    month,
    status: "done",
    entrants: [...players(8), "p09"],
    swissRounds: 1,
    cutSize: 8,
    rounds: [
      round(
        match("p01", "p05", "A"),
        match("p02", "p06", "A"),
        match("p03", "p07", "A"),
        match("p04", "p08", "A"),
        match("p09", null),
      ),
    ],
    cut: [
      round(
        match("p01", "p08", "A"),
        match("p04", "p05", "A"),
        match("p02", "p07", "A"),
        match("p03", "p06", "A"),
      ),
      round(match("p01", "p04", "A"), match("p02", "p03", "A")),
      round(match("p01", "p02", "A")),
    ],
  });
}

describe("event points", () => {
  it("with a cut: champion 10, finalist 7, top 4 5, top 8 3, everyone else 1", () => {
    const res = eventResults(finishedCutEvent(), byId);
    const pts = Object.fromEntries([...res].map(([id, r]) => [id, [r.points, r.label]]));
    expect(pts).toEqual({
      p01: [10, "Champion"],
      p02: [7, "Finalist"],
      p03: [5, "Top 4"],
      p04: [5, "Top 4"],
      p05: [3, "Top 8"],
      p06: [3, "Top 8"],
      p07: [3, "Top 8"],
      p08: [3, "Top 8"],
      p09: [1, expect.stringMatching(/^Rank \d+$/)],
    });
  });

  it("Swiss-only: by final Swiss rank with the same table", () => {
    expect([1, 2, 3, 4, 5, 8, 9, 20].map(pointsForSwissRank)).toEqual([10, 7, 5, 5, 3, 3, 1, 1]);
    const ev = newEvent({
      id: "e",
      status: "done",
      cutSize: 0,
      entrants: ["a", "b", "c"],
      rounds: [round(match("a", "b", "A"), match("c", null))],
    });
    const res = eventResults(ev, byId);
    expect(res.get("a")).toEqual({ points: 10, label: "Champion", rank: 1 });
    expect(res.get("c")).toEqual({ points: 7, label: "Rank 2", rank: 2 });
    expect(res.get("b")).toEqual({ points: 5, label: "Rank 3", rank: 3 });
  });

  it("every entrant scores 1, even one who joined late or dropped without playing", () => {
    const ev = finishedCutEvent();
    ev.entrants.push("late");
    ev.dropped.push("late");
    expect(eventResults(ev, byId).get("late")).toMatchObject({ points: 1 });
  });
});

describe("leaderboards", () => {
  it("only finished events count", () => {
    const open = { ...finishedCutEvent("e2"), status: "cut" as const };
    expect(leaderboard([open], byId)).toEqual([]);
  });

  it("sums event points, counts titles and months", () => {
    const rows = leaderboard([finishedCutEvent("e1", 1), finishedCutEvent("e3", 2)], byId);
    const p01 = rows.find((r) => r.id === "p01")!;
    expect(p01).toMatchObject({ rank: 1, total: 20, titles: 2, played: 2, byMonth: { 1: 10, 2: 10 } });
  });

  const swiss = (id: string, winner: string, loser: string, bye?: string): EventState =>
    newEvent({
      id,
      status: "done",
      cutSize: 0,
      entrants: bye ? [winner, loser, bye] : [winner, loser],
      rounds: [round(match(winner, loser, "A"), ...(bye ? [match(bye, null)] : []))],
    });

  it("equal total and titles share a rank; the next rank skips", () => {
    const rows = leaderboard([swiss("e1", "x", "y"), swiss("e2", "y", "z")], byId);
    // y: 7 + 10 = 17 (1 title), x: 10 (1 title), z: 7 (0 titles)
    expect(rows.map((r) => [r.id, r.total, r.titles, r.rank])).toEqual([
      ["y", 17, 1, 1],
      ["x", 10, 1, 2],
      ["z", 7, 0, 3],
    ]);
    const tied = leaderboard([swiss("e1", "x", "y"), swiss("e2", "y", "x")], byId);
    expect(tied.map((r) => [r.id, r.total, r.titles, r.rank])).toEqual([
      ["x", 17, 1, 1],
      ["y", 17, 1, 1],
    ]);
  });

  it("titles break a tie on total before the name does", () => {
    // "zz" wins one event: 10 points, 1 title.
    // "aa" finishes 3rd of 3 twice (the opponent and the bye player both have 3 points): 5 + 5 = 10, 0 titles.
    const rows = leaderboard(
      [swiss("e1", "zz", "y1"), swiss("e2", "p", "aa", "q"), swiss("e3", "p", "aa", "q")],
      byId,
    );
    const zz = rows.find((r) => r.id === "zz")!;
    const aa = rows.find((r) => r.id === "aa")!;
    expect([zz.total, zz.titles, aa.total, aa.titles]).toEqual([10, 1, 10, 0]);
    expect(zz.rank).toBeLessThan(aa.rank);
  });
});
