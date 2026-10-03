import { describe, expect, it } from "vitest";
import {
  EngineError,
  addEntrant,
  finishEvent,
  newEvent,
  nextStep,
  pairNextRound,
  removeEntrant,
  reopenEvent,
  resetEvent,
  setResult,
  startCut,
  startSwiss,
  undoRound,
} from "./event";
import { seededRng } from "./rng";
import { byId, players } from "./test-helpers";
import type { EventState } from "./types";

function report(ev: EventState, result: "A" | "B" | "D" = "A"): EventState {
  const ri = ev.rounds.length - 1;
  ev.rounds[ri]!.matches.forEach((m, mi) => {
    if (m.b === null) return;
    ev = setResult(ev, { phase: "swiss", round: ri, match: mi, game: 1, result }, byId, seededRng(1));
    if (ev.format === "double")
      ev = setResult(ev, { phase: "swiss", round: ri, match: mi, game: 2, result }, byId, seededRng(1));
  });
  return ev;
}

describe("event lifecycle", () => {
  it("runs sign-up -> Swiss -> cut -> done end to end", () => {
    const rng = seededRng(11);
    let ev = newEvent({ id: "e", entrants: players(9), cutSize: 4 });
    expect(nextStep(ev)).toBe("start-swiss");
    ev = startSwiss(ev, byId, rng);
    expect(ev.swissRounds).toBe(5);
    expect(nextStep(ev)).toBe("report-results");
    ev = report(ev);
    while (nextStep(ev) === "pair-next") ev = report(pairNextRound(ev, byId, rng));
    expect(ev.rounds).toHaveLength(5);
    expect(nextStep(ev)).toBe("start-cut");
    ev = startCut(ev, byId, rng);
    for (let ri = 0; ev.status === "cut"; ri++) {
      for (let mi = 0; mi < ev.cut[ri]!.matches.length; mi++) {
        ev = setResult(ev, { phase: "cut", round: ri, match: mi, game: 1, result: "A" }, byId, rng);
      }
    }
    expect(ev.status).toBe("done");
    expect(nextStep(ev)).toBe("done");
  });

  it("an admin override of Swiss rounds is kept", () => {
    const ev = startSwiss(newEvent({ id: "e", entrants: players(8), swissRounds: 3 }), byId, seededRng(1));
    expect(ev.swissRounds).toBe(3);
  });

  it("guards against out-of-order actions", () => {
    const rng = seededRng(1);
    expect(() => startSwiss(newEvent({ id: "e", entrants: ["solo"] }), byId, rng)).toThrow(EngineError);
    let ev = startSwiss(newEvent({ id: "e", entrants: players(4), cutSize: 0, swissRounds: 2 }), byId, rng);
    expect(() => pairNextRound(ev, byId, rng)).toThrow(/not finished/);
    expect(() => startSwiss(ev, byId, rng)).toThrow(/already started/);
    expect(() => removeEntrant(ev, "p01")).toThrow(/Drop them instead/);
    expect(() => finishEvent(ev)).toThrow(EngineError);
    ev = report(ev);
    expect(() =>
      setResult(ev, { phase: "swiss", round: 0, match: 0, game: 2, result: "A" }, byId, rng),
    ).toThrow(/one game/);
    ev = report(pairNextRound(ev, byId, rng));
    expect(() => startCut(ev, byId, rng)).toThrow(EngineError);
    ev = finishEvent(ev);
    expect(() => addEntrant(ev, "late")).toThrow(/Reopen/);
  });

  it("repair mode: earlier Swiss rounds can be corrected; pairings stay", () => {
    const rng = seededRng(3);
    let ev = report(startSwiss(newEvent({ id: "e", entrants: players(4), cutSize: 0 }), byId, rng));
    ev = report(pairNextRound(ev, byId, rng));
    const pairingsBefore = ev.rounds.map((r) => r.matches.map((m) => [m.a, m.b]));
    ev = setResult(ev, { phase: "swiss", round: 0, match: 0, game: 1, result: "B" }, byId, rng);
    expect(ev.rounds[0]!.matches[0]!.g1).toBe("B");
    expect(ev.rounds.map((r) => r.matches.map((m) => [m.a, m.b]))).toEqual(pairingsBefore);
  });

  it("clearing a result reopens the round", () => {
    const rng = seededRng(3);
    let ev = report(startSwiss(newEvent({ id: "e", entrants: players(4), cutSize: 0 }), byId, rng));
    ev = setResult(ev, { phase: "swiss", round: 0, match: 0, game: 1, result: null }, byId, rng);
    expect(nextStep(ev)).toBe("report-results");
  });

  it("double-sided rounds need both games reported", () => {
    const rng = seededRng(3);
    let ev = startSwiss(newEvent({ id: "e", format: "double", entrants: players(4), cutSize: 0 }), byId, rng);
    expect(ev.swissRounds).toBe(3);
    ev = setResult(ev, { phase: "swiss", round: 0, match: 0, game: 1, result: "A" }, byId, rng);
    ev = setResult(ev, { phase: "swiss", round: 0, match: 1, game: 1, result: "A" }, byId, rng);
    expect(nextStep(ev)).toBe("report-results");
    ev = report(ev);
    expect(nextStep(ev)).toBe("pair-next");
  });

  it("undo last Swiss round; undoing round 1 returns to sign-up", () => {
    const rng = seededRng(3);
    let ev = report(startSwiss(newEvent({ id: "e", entrants: players(4), cutSize: 0 }), byId, rng));
    ev = pairNextRound(ev, byId, rng);
    ev = undoRound(ev, "swiss");
    expect(ev.rounds).toHaveLength(1);
    ev = undoRound(ev, "swiss");
    expect(ev).toMatchObject({ status: "signup", rounds: [] });
  });

  it("reopen a finished event returns to Swiss (no cut) or the cut", () => {
    const rng = seededRng(3);
    let ev = report(startSwiss(newEvent({ id: "e", entrants: players(2), cutSize: 0 }), byId, rng));
    ev = finishEvent(ev);
    expect(reopenEvent(ev).status).toBe("swiss");
    expect(reopenEvent({ ...ev, cut: [{ matches: [] }] }).status).toBe("cut");
    expect(() => reopenEvent(reopenEvent(ev))).toThrow(EngineError);
  });

  it("reset event keeps entrants and clears rounds", () => {
    const rng = seededRng(3);
    const ev = resetEvent(report(startSwiss(newEvent({ id: "e", entrants: players(4) }), byId, rng)));
    expect(ev).toMatchObject({ status: "signup", rounds: [], cut: [], entrants: players(4) });
  });

  it("operations never mutate their input", () => {
    const rng = seededRng(3);
    const ev = newEvent({ id: "e", entrants: players(4) });
    const frozen = structuredClone(ev);
    startSwiss(ev, byId, rng);
    addEntrant(ev, "x");
    expect(ev).toEqual(frozen);
  });
});
