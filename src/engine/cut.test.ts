import { describe, expect, it } from "vitest";
import { cutBias, cutSeedIds, cutSide, cutWinner, effectiveCutSize, firstCutRound, seedOrder } from "./cut";
import { EngineError, newEvent, restartRound, setResult, startCut, startSwiss, undoRound } from "./event";
import { seededRng } from "./rng";
import { byId, match, players, round } from "./test-helpers";
import type { EventState } from "./types";

/** 8 players, one Swiss round already reported so that standings are p01 > p02 > ... > p08. */
function swissDone(cutSize: number, dropped: string[] = []): EventState {
  // Points: p01..p04 win (3), p05..p08 lose (0). SoS/name decide the rest: SoS of winners = 0,
  // of losers = 3; names order the rest.
  const ids = players(8);
  return newEvent({
    id: "e",
    entrants: ids,
    status: "swiss",
    swissRounds: 1,
    cutSize,
    dropped,
    rounds: [
      round(
        match("p01", "p05", "A"),
        match("p02", "p06", "A"),
        match("p03", "p07", "A"),
        match("p04", "p08", "A"),
      ),
    ],
  });
}

describe("cut seeding", () => {
  it("uses standard bracket order", () => {
    expect(seedOrder(8)).toEqual([1, 8, 4, 5, 2, 7, 3, 6]);
    expect(seedOrder(4)).toEqual([1, 4, 2, 3]);
  });

  it("seeds 1v8, 4v5, 2v7, 3v6 from the Swiss standings", () => {
    const cut = firstCutRound(swissDone(8), byId, seededRng(1));
    expect(cut.matches.map((m) => [m.a, m.b])).toEqual([
      ["p01", "p08"],
      ["p04", "p05"],
      ["p02", "p07"],
      ["p03", "p06"],
    ]);
  });

  it("top 4 is 1v4, 2v3", () => {
    const cut = firstCutRound(swissDone(4), byId, seededRng(1));
    expect(cut.matches.map((m) => [m.a, m.b])).toEqual([
      ["p01", "p04"],
      ["p02", "p03"],
    ]);
  });

  it("shrinks the cut to fit the field; below 4 there is no cut", () => {
    expect(effectiveCutSize(8, 20)).toBe(8);
    expect(effectiveCutSize(8, 7)).toBe(4);
    expect(effectiveCutSize(8, 4)).toBe(4);
    expect(effectiveCutSize(4, 3)).toBe(0);
    expect(effectiveCutSize(0, 10)).toBe(0);
    const started = startSwiss(newEvent({ id: "e", entrants: players(7), cutSize: 8 }), byId, seededRng(1));
    expect(started.cutSize).toBe(4);
  });

  it("dropped players do not make the cut; the next player moves up", () => {
    expect(cutSeedIds(swissDone(4, ["p02"]), byId)).toEqual(["p01", "p03", "p04", "p05"]);
  });
});

describe("cut sides", () => {
  it("are random in the first cut round", () => {
    const sides = new Set<string>();
    for (let seed = 1; seed <= 20; seed++)
      sides.add(firstCutRound(swissDone(4), byId, seededRng(seed)).matches[0]!.corp!);
    expect(sides).toEqual(new Set(["a", "b"]));
  });

  it("later: each plays the side they have played less when one has more Corp and the other does not", () => {
    // x was Corp once (bias +1), y was Runner once (bias -1) -> y is Corp.
    const prior = [round(match("x", "q", "A", "a"), match("r", "y", "B", "a"))];
    expect(cutBias(prior)).toMatchObject({ x: 1, y: -1 });
    expect(cutSide(prior, "x", "y", seededRng(1))).toBe("b");
    expect(cutSide(prior, "y", "x", seededRng(1))).toBe("a");
  });

  it("an even split counts as 'not more Corp'", () => {
    // x: Corp once (+1). z: Corp once and Runner once (0) -> z is Corp.
    const prior = [
      round(match("x", "q", "A", "a"), match("z", "w", "A", "a")),
      round(match("v", "z", "B", "a")),
    ];
    expect(cutBias(prior)).toMatchObject({ x: 1, z: 0 });
    expect(cutSide(prior, "x", "z", seededRng(1))).toBe("b");
  });

  it("otherwise (both owe the same side) it is random", () => {
    const prior = [round(match("x", "q", "A", "a"), match("y", "w", "A", "a"))];
    const sides = new Set<string>();
    for (let seed = 1; seed <= 20; seed++) sides.add(cutSide(prior, "x", "y", seededRng(seed)));
    expect(sides).toEqual(new Set(["a", "b"]));
  });
});

describe("running the cut", () => {
  it("is single games, auto-advances winners and finishes after the final", () => {
    const rng = seededRng(4);
    let ev = startCut(swissDone(4), byId, rng);
    expect(ev.status).toBe("cut");
    expect(() =>
      setResult(ev, { phase: "cut", round: 0, match: 0, game: 2, result: "A" }, byId, rng),
    ).toThrow(EngineError);
    ev = setResult(ev, { phase: "cut", round: 0, match: 0, game: 1, result: "B" }, byId, rng); // p04 beats p01
    expect(ev.cut).toHaveLength(1);
    ev = setResult(ev, { phase: "cut", round: 0, match: 1, game: 1, result: "A" }, byId, rng); // p02 beats p03
    expect(ev.cut).toHaveLength(2);
    expect(ev.cut[1]!.matches[0]).toMatchObject({ a: "p04", b: "p02", g1: null });
    ev = setResult(ev, { phase: "cut", round: 1, match: 0, game: 1, result: "A" }, byId, rng);
    expect(ev.status).toBe("done");
  });

  it("a tied cut game advances the higher seed", () => {
    const seeds = new Map([
      ["p01", 1],
      ["p04", 4],
    ]);
    expect(cutWinner(match("p04", "p01", "D"), seeds)).toBe("p01");
    expect(cutWinner(match("p01", "p04", "D"), seeds)).toBe("p01");
    const rng = seededRng(1);
    let ev = startCut(swissDone(4), byId, rng);
    ev = setResult(ev, { phase: "cut", round: 0, match: 0, game: 1, result: "D" }, byId, rng);
    ev = setResult(ev, { phase: "cut", round: 0, match: 1, game: 1, result: "D" }, byId, rng);
    expect(ev.cut[1]!.matches[0]).toMatchObject({ a: "p01", b: "p02" });
  });

  it("only the current cut round can be edited", () => {
    const rng = seededRng(1);
    let ev = startCut(swissDone(4), byId, rng);
    ev = setResult(ev, { phase: "cut", round: 0, match: 0, game: 1, result: "A" }, byId, rng);
    ev = setResult(ev, { phase: "cut", round: 0, match: 1, game: 1, result: "A" }, byId, rng);
    expect(() =>
      setResult(ev, { phase: "cut", round: 0, match: 0, game: 1, result: "B" }, byId, rng),
    ).toThrow(/current cut round/);
  });

  it("restart cut round: first round re-seeds with fresh random sides, later rounds re-pair winners", () => {
    const rng = seededRng(7);
    let ev = startCut(swissDone(8), byId, rng);
    const again = restartRound(ev, "cut", byId, rng);
    expect(again.cut).toHaveLength(1);
    expect(again.cut[0]!.matches.map((m) => [m.a, m.b])).toEqual(ev.cut[0]!.matches.map((m) => [m.a, m.b]));
    for (let i = 0; i < 4; i++)
      ev = setResult(ev, { phase: "cut", round: 0, match: i, game: 1, result: "A" }, byId, rng);
    ev = setResult(ev, { phase: "cut", round: 1, match: 0, game: 1, result: "B" }, byId, rng);
    const restarted = restartRound(ev, "cut", byId, rng);
    expect(restarted.cut).toHaveLength(2);
    expect(restarted.cut[1]!.matches.map((m) => [m.a, m.b, m.g1])).toEqual([
      ["p01", "p04", null],
      ["p02", "p03", null],
    ]);
  });

  it("undo cut round goes back one round, and from the first round back to Swiss", () => {
    const rng = seededRng(1);
    let ev = startCut(swissDone(4), byId, rng);
    ev = setResult(ev, { phase: "cut", round: 0, match: 0, game: 1, result: "A" }, byId, rng);
    ev = setResult(ev, { phase: "cut", round: 0, match: 1, game: 1, result: "A" }, byId, rng);
    ev = undoRound(ev, "cut");
    expect(ev.cut).toHaveLength(1);
    ev = undoRound(ev, "cut");
    expect(ev).toMatchObject({ status: "swiss", cut: [] });
  });
});
