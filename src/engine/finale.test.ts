import { describe, expect, it } from "vitest";
import { cutSeedIds, firstCutRound } from "./cut";
import { newEvent, setResult, startCut, startSwiss, undoRound, resetEvent } from "./event";
import { eventResults, leaderboard } from "./points";
import { seededRng } from "./rng";
import { FINALE } from "./rules";
import { finaleSeedOrder } from "./season";
import { byId, match, players, round } from "./test-helpers";
import type { EventState } from "./types";

/** 10 players after one Swiss round: p01..p05 won, p06..p10 lost. */
function finaleAfterSwiss(): EventState {
  return newEvent({
    id: "finale",
    month: 2,
    status: "swiss",
    swissRounds: 1,
    cutSize: 8,
    pointsMultiplier: FINALE.pointsMultiplier,
    entrants: players(10),
    rounds: [
      round(
        match("p01", "p06", "A"),
        match("p02", "p07", "A"),
        match("p03", "p08", "A"),
        match("p04", "p09", "A"),
        match("p05", "p10", "A"),
      ),
    ],
  });
}

describe("season finale", () => {
  it("doubles league points (titles still count once)", () => {
    const ev = newEvent({
      id: "f",
      status: "done",
      cutSize: 0,
      pointsMultiplier: 2,
      entrants: ["a", "b", "c"],
      rounds: [round(match("a", "b", "A"), match("c", null))],
    });
    const res = eventResults(ev, byId);
    expect([...res.values()].map((r) => r.points).sort((x, y) => y - x)).toEqual([20, 14, 10]);
    expect(leaderboard([ev], byId)[0]).toMatchObject({ id: "a", total: 20, titles: 1 });
  });

  it("seeds by season points, then event wins, ties broken by the finale Swiss round", () => {
    const ev = finaleAfterSwiss();
    // p10 leads the season but lost the finale round; p06 and p01 tie on season points.
    const season: Record<string, { total: number; titles: number }> = {
      p10: { total: 30, titles: 2 },
      p06: { total: 20, titles: 0 },
      p01: { total: 20, titles: 0 },
      p07: { total: 20, titles: 1 },
    };
    const order = finaleSeedOrder(ev, byId, (id) => season[id]);
    expect(order.slice(0, 4)).toEqual(["p10", "p07", "p01", "p06"]);
    // Players without season points follow in Swiss order.
    expect(order.slice(4)).toEqual(["p02", "p03", "p04", "p05", "p08", "p09"]);
  });

  it("the cut uses the season order, keeps it for later rounds and drops it on undo/reset", () => {
    const ev = finaleAfterSwiss();
    const seasonOrder = ["p10", "p09", "p08", "p07", "p06", "p05", "p04", "p03", "p02", "p01"];
    const rng = seededRng(1);
    let cut = startCut(ev, byId, rng, seasonOrder);
    expect(cut.cutSeedOrder).toEqual(seasonOrder);
    expect(cut.cut[0]!.matches.map((m) => [m.a, m.b])).toEqual([
      ["p10", "p03"],
      ["p07", "p06"],
      ["p09", "p04"],
      ["p08", "p05"],
    ]);
    // A tie advances the higher *season* seed.
    cut = setResult(cut, { phase: "cut", round: 0, match: 0, game: 1, result: "D" }, byId, rng);
    for (let i = 1; i < 4; i++)
      cut = setResult(cut, { phase: "cut", round: 0, match: i, game: 1, result: "B" }, byId, rng);
    expect(cut.cut[1]!.matches[0]!.a).toBe("p10");

    expect(undoRound(undoRound(cut, "cut"), "cut").cutSeedOrder).toBeUndefined();
    expect(resetEvent(cut).cutSeedOrder).toBeUndefined();
  });

  it("dropped players are skipped and the next season seed moves up", () => {
    const ev = { ...finaleAfterSwiss(), dropped: ["p10"], cutSeedOrder: ["p10", "p09", "p08"] };
    expect(cutSeedIds(ev, byId).slice(0, 3)).toEqual(["p09", "p08", "p01"]);
  });

  it("without a season order the cut is seeded from Swiss as usual", () => {
    const ev = finaleAfterSwiss();
    expect(firstCutRound(ev, byId, seededRng(1)).matches[0]).toMatchObject({ a: "p01" });
    expect(startCut(ev, byId, seededRng(1)).cutSeedOrder).toBeUndefined();
  });

  it("a finale event runs 1 Swiss round then the top 8 cut", () => {
    const ev = startSwiss(
      newEvent({
        id: "f",
        entrants: players(12),
        swissRounds: FINALE.swissRounds,
        cutSize: FINALE.cutSize,
        pointsMultiplier: 2,
      }),
      byId,
      seededRng(3),
    );
    expect(ev.swissRounds).toBe(1);
    expect(ev.cutSize).toBe(8);
  });
});
