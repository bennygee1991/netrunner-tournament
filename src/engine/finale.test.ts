import { describe, expect, it } from "vitest";
import { cutSeedIds, cutWinner, needsDecider } from "./cut";
import {
  newEvent,
  pickCutSides,
  resetEvent,
  restartRound,
  setResult,
  sidePicker,
  startCut,
  undoRound,
  EngineError,
} from "./event";
import { eventResults, leaderboard } from "./points";
import { seededRng } from "./rng";
import { FINALE } from "./rules";
import { byId, match, players, round } from "./test-helpers";
import type { EventState, GameResult } from "./types";

/** 6 players after 3 Swiss rounds, standings p01 > p02 > ... > p06. Series top 4 ready to start. */
function finaleReadyForCut(): EventState {
  return newEvent({
    id: "finale",
    month: 2,
    status: "swiss",
    swissRounds: 1,
    cutSize: FINALE.cutSize,
    cutFormat: FINALE.cutFormat,
    pointsMultiplier: FINALE.pointsMultiplier,
    entrants: players(6),
    rounds: [round(match("p01", "p06", "A"), match("p02", "p05", "A"), match("p03", "p04", "A"))],
  });
}

const rng = seededRng(7);
const started = () => startCut(finaleReadyForCut(), byId, rng);
const res = (ev: EventState, m: number, game: 1 | 2 | 3, result: GameResult | null, r = ev.cut.length - 1) =>
  setResult(ev, { phase: "cut", round: r, match: m, game, result }, byId, rng);

describe("season finale points", () => {
  it("doubles league points (titles still count once)", () => {
    const ev = newEvent({
      id: "f",
      status: "done",
      cutSize: 0,
      pointsMultiplier: 2,
      entrants: ["a", "b", "c"],
      rounds: [round(match("a", "b", "A"), match("c", null))],
    });
    const out = eventResults(ev, byId);
    expect([...out.values()].map((r) => r.points).sort((x, y) => y - x)).toEqual([20, 14, 10]);
    expect(leaderboard([ev], byId)[0]).toMatchObject({ id: "a", total: 20, titles: 1 });
  });
});

describe("series cut (higher seed picks sides, swap, coin-flip decider)", () => {
  it("seeds the top 4 from Swiss and waits for sides", () => {
    const ev = started();
    expect(cutSeedIds(ev, byId)).toEqual(["p01", "p02", "p03", "p04"]);
    // Bracket 1 v 4, 2 v 3; no sides yet.
    expect(ev.cut[0]!.matches.map((m) => [m.a, m.b, m.corp])).toEqual([
      ["p01", "p04", null],
      ["p02", "p03", null],
    ]);
    expect(sidePicker(ev, 0, 0, byId)).toBe("p01");
    expect(sidePicker(ev, 0, 1, byId)).toBe("p02");
  });

  it("needs sides before results; sides lock once a game is in", () => {
    let ev = started();
    expect(() => res(ev, 0, 1, "A")).toThrow(EngineError);
    ev = pickCutSides(ev, { round: 0, match: 0, corpId: "p04" });
    expect(ev.cut[0]!.matches[0]!.corp).toBe("b");
    ev = pickCutSides(ev, { round: 0, match: 0, corpId: "p01" }); // change of mind before game 1
    expect(ev.cut[0]!.matches[0]!.corp).toBe("a");
    ev = res(ev, 0, 1, "A");
    expect(() => pickCutSides(ev, { round: 0, match: 0, corpId: "p04" })).toThrow(/fixed/);
    expect(() => pickCutSides(ev, { round: 0, match: 0, corpId: "p02" })).toThrow(/not in this match/);
  });

  it("2-0 wins without a decider; game 3 is refused", () => {
    let ev = pickCutSides(started(), { round: 0, match: 0, corpId: "p01" });
    ev = res(ev, 0, 1, "B");
    expect(() => res(ev, 0, 3, "B")).toThrow(/only played/);
    ev = res(ev, 0, 2, "B");
    const m = ev.cut[0]!.matches[0]!;
    expect(needsDecider(m)).toBe(false);
    expect(cutWinner(m, new Map(), "series")).toBe("p04");
    expect(m.corp3).toBeNull();
  });

  it("1-1 needs game 3 with coin-flip sides; correcting game 2 cancels it", () => {
    let ev = pickCutSides(started(), { round: 0, match: 0, corpId: "p01" });
    ev = res(ev, 0, 1, "A");
    ev = res(ev, 0, 2, "B");
    let m = ev.cut[0]!.matches[0]!;
    expect(needsDecider(m)).toBe(true);
    expect(m.corp3 === "a" || m.corp3 === "b").toBe(true);
    expect(cutWinner(m, new Map(), "series")).toBeNull();
    ev = res(ev, 0, 3, "B");
    expect(cutWinner(ev.cut[0]!.matches[0]!, new Map(), "series")).toBe("p04");
    // Game 2 was actually won by p01: 2-0, the decider is cleared.
    ev = res(ev, 0, 2, "A");
    m = ev.cut[0]!.matches[0]!;
    expect([m.g3, m.corp3]).toEqual([null, null]);
    expect(cutWinner(m, new Map(), "series")).toBe("p01");
  });

  it("a tie counts for nobody: 1 win and a tie wins; two ties go to game 3; a tied game 3 goes to the higher seed", () => {
    let ev = pickCutSides(started(), { round: 0, match: 1, corpId: "p03" });
    ev = res(ev, 1, 1, "D");
    ev = res(ev, 1, 2, "B");
    expect(cutWinner(ev.cut[0]!.matches[1]!, new Map(), "series")).toBe("p03");
    ev = res(ev, 1, 2, "D");
    expect(needsDecider(ev.cut[0]!.matches[1]!)).toBe(true);
    ev = res(ev, 1, 3, "D");
    const seeds = new Map([
      ["p02", 2],
      ["p03", 3],
    ]);
    expect(cutWinner(ev.cut[0]!.matches[1]!, seeds, "series")).toBe("p02");
  });

  it("pairs the final from the semifinal winners and finishes the event with doubled points", () => {
    let ev = started();
    ev = pickCutSides(ev, { round: 0, match: 0, corpId: "p01" });
    ev = pickCutSides(ev, { round: 0, match: 1, corpId: "p03" });
    for (const [mi, r] of [
      [0, "A"],
      [1, "B"],
    ] as const) {
      ev = res(ev, mi, 1, r);
      ev = res(ev, mi, 2, r);
    }
    expect(ev.cut).toHaveLength(2);
    const final = ev.cut[1]!.matches[0]!;
    expect([final.a, final.b, final.corp]).toEqual(["p01", "p03", null]);
    expect(sidePicker(ev, 1, 0, byId)).toBe("p01");
    ev = pickCutSides(ev, { round: 1, match: 0, corpId: "p03" });
    ev = res(ev, 0, 1, "B");
    ev = res(ev, 0, 2, "A");
    expect(ev.status).toBe("cut");
    ev = res(ev, 0, 3, "B");
    expect(ev.status).toBe("done");
    const out = eventResults(ev, byId);
    expect(out.get("p03")).toMatchObject({ label: "Champion", points: 20 });
    expect(out.get("p01")).toMatchObject({ label: "Finalist", points: 14 });
    expect(out.get("p02")).toMatchObject({ label: "Top 4", points: 10 });
    expect(out.get("p05")).toMatchObject({ points: 2 });
  });

  it("restarting a cut round keeps the series format", () => {
    let ev = started();
    expect(
      restartRound(ev, "cut", byId, rng).cut[0]!.matches.every((m) => m.corp === null && m.g3 === null),
    ).toBe(true);
    ev = pickCutSides(ev, { round: 0, match: 0, corpId: "p01" });
    ev = pickCutSides(ev, { round: 0, match: 1, corpId: "p02" });
    for (const mi of [0, 1]) {
      ev = res(ev, mi, 1, "A");
      ev = res(ev, mi, 2, "A");
    }
    const final = restartRound(ev, "cut", byId, rng).cut[1]!.matches[0]!;
    expect([final.corp, final.g3]).toEqual([null, null]);
  });

  it("undo and reset clear the cut", () => {
    const ev = pickCutSides(started(), { round: 0, match: 0, corpId: "p01" });
    expect(undoRound(ev, "cut").cut).toEqual([]);
    expect(resetEvent(ev).cut).toEqual([]);
  });

  it("single-game cuts are unchanged (prototype behaviour)", () => {
    const ev = startCut({ ...finaleReadyForCut(), cutFormat: undefined }, byId, rng);
    expect(ev.cut[0]!.matches.every((m) => m.corp !== null && m.g3 === undefined)).toBe(true);
    expect(() => res(ev, 0, 2, "A")).toThrow(/single games/);
  });
});
