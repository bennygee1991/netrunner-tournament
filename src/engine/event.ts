import { effectiveCutSize, cutSeeds, firstCutRound, nextCutRound } from "./cut";
import { pairRound } from "./pairing";
import { DEFAULT_CUT_SIZE, defaultSwissRounds } from "./rules";
import type { EventState, GameResult, NameOf, Phase, Rng, Round } from "./types";

/** Thrown when an operation is not allowed in the event's current state. */
export class EngineError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "EngineError";
  }
}

function fail(message: string): never {
  throw new EngineError(message);
}

function clone(ev: EventState): EventState {
  return structuredClone(ev);
}

export function newEvent(init: Partial<EventState> & Pick<EventState, "id">): EventState {
  return {
    month: 1,
    format: "single",
    status: "signup",
    entrants: [],
    dropped: [],
    swissRounds: null,
    cutSize: DEFAULT_CUT_SIZE,
    rounds: [],
    cut: [],
    ...init,
  };
}

/** True when every non-bye match in the round has all its results. */
export function roundComplete(ev: EventState, round: Round, phase: Phase): boolean {
  const double = phase === "swiss" && ev.format === "double";
  return round.matches.every(
    (m) => m.b === null || (double ? m.g1 !== null && m.g2 !== null : m.g1 !== null),
  );
}

function lastRound(rounds: Round[]): Round | undefined {
  return rounds[rounds.length - 1];
}

function swissFinished(ev: EventState): boolean {
  const last = lastRound(ev.rounds);
  return !!last && roundComplete(ev, last, "swiss") && ev.rounds.length >= (ev.swissRounds ?? 0);
}

// ------------------------------------------------------------------ what can the organizer do now?

export type NextStep = "start-swiss" | "report-results" | "pair-next" | "start-cut" | "finish" | "done";

export function nextStep(ev: EventState): NextStep {
  if (ev.status === "signup") return "start-swiss";
  if (ev.status === "done") return "done";
  if (ev.status === "cut") return "report-results";
  const last = lastRound(ev.rounds);
  if (!last || !roundComplete(ev, last, "swiss")) return "report-results";
  if (ev.rounds.length < (ev.swissRounds ?? 0)) return "pair-next";
  return ev.cutSize > 0 ? "start-cut" : "finish";
}

// ------------------------------------------------------------------ entrants

/** Adds an entrant (sign-up approval, walk-in, or late add mid-event with zero points). */
export function addEntrant(ev: EventState, id: string): EventState {
  if (ev.status === "done") fail("This event is finished. Reopen it first.");
  if (ev.entrants.includes(id)) return ev;
  const next = clone(ev);
  next.entrants.push(id);
  return next;
}

/** Removes an entrant before the event starts. */
export function removeEntrant(ev: EventState, id: string): EventState {
  if (ev.status !== "signup")
    fail("Entrants can only be removed before the event starts. Drop them instead.");
  const next = clone(ev);
  next.entrants = next.entrants.filter((x) => x !== id);
  next.dropped = next.dropped.filter((x) => x !== id);
  return next;
}

/** Drop: excluded from future pairings (and the cut), kept in standings. */
export function dropEntrant(ev: EventState, id: string): EventState {
  if (!ev.entrants.includes(id)) fail("Not an entrant of this event.");
  if (ev.dropped.includes(id)) return ev;
  const next = clone(ev);
  next.dropped.push(id);
  return next;
}

export function undropEntrant(ev: EventState, id: string): EventState {
  const next = clone(ev);
  next.dropped = next.dropped.filter((x) => x !== id);
  return next;
}

// ------------------------------------------------------------------ Swiss

/**
 * Starts Swiss (prototype `startswiss`): default rounds if none set, cut shrunk to fit the field,
 * round 1 paired at random.
 */
export function startSwiss(ev: EventState, nameOf: NameOf, rng: Rng): EventState {
  if (ev.status !== "signup") fail("Swiss has already started.");
  const n = ev.entrants.length;
  if (n < 2) fail("At least 2 entrants are needed to start.");
  const next = clone(ev);
  if (!next.swissRounds) next.swissRounds = defaultSwissRounds(next.format, n);
  next.cutSize = effectiveCutSize(next.cutSize, n);
  next.rounds = [];
  next.cut = [];
  next.status = "swiss";
  next.rounds.push(pairRound(next, nameOf, rng).round);
  return next;
}

export function pairNextRound(ev: EventState, nameOf: NameOf, rng: Rng): EventState {
  if (nextStep(ev) !== "pair-next") fail("The current round is not finished, or all Swiss rounds are done.");
  const next = clone(ev);
  next.rounds.push(pairRound(next, nameOf, rng).round);
  return next;
}

/**
 * Restart round: discard the current round's pairings and results and pair again, which picks up
 * late additions and excludes drops. In the cut, the round is re-paired from the previous round's
 * winners (or re-seeded from Swiss for the first cut round) with fresh sides.
 */
export function restartRound(ev: EventState, phase: Phase, nameOf: NameOf, rng: Rng): EventState {
  const next = clone(ev);
  if (phase === "swiss") {
    if (ev.status !== "swiss" || !ev.rounds.length) fail("There is no Swiss round to restart.");
    next.rounds.pop();
    next.rounds.push(pairRound(next, nameOf, rng).round);
    return next;
  }
  if (ev.status !== "cut" || !ev.cut.length) fail("There is no cut round to restart.");
  next.cut.pop();
  if (next.cut.length === 0) {
    next.cut.push(firstCutRound(next, nameOf, rng));
  } else {
    const prev = next.cut[next.cut.length - 1]!;
    next.cut.push(nextCutRound(next.cut, prev, cutSeeds(next, nameOf), rng));
  }
  next.status = "cut";
  return next;
}

/** Undo the last round: Swiss back to sign-up when none remain; cut back to Swiss after its first round. */
export function undoRound(ev: EventState, phase: Phase): EventState {
  const next = clone(ev);
  if (phase === "swiss") {
    if (ev.status !== "swiss" || !ev.rounds.length) fail("There is no Swiss round to undo.");
    next.rounds.pop();
    if (!next.rounds.length) next.status = "signup";
    return next;
  }
  if (ev.status !== "cut" || !ev.cut.length) fail("There is no cut round to undo.");
  if (next.cut.length > 1) next.cut.pop();
  else {
    next.cut = [];
    next.status = "swiss";
  }
  return next;
}

// ------------------------------------------------------------------ results

export interface ResultInput {
  phase: Phase;
  round: number;
  match: number;
  /** 1, or 2 for double-sided Swiss game 2. */
  game: 1 | 2;
  /** null clears the result. */
  result: GameResult | null;
}

/**
 * Records a result. Any Swiss round can be edited while Swiss is running (repair mode: standings
 * recompute, existing pairings are untouched). In the cut only the current round can be edited;
 * when it is complete the next cut round is paired automatically, and the final finishes the event.
 */
export function setResult(ev: EventState, input: ResultInput, nameOf: NameOf, rng: Rng): EventState {
  const { phase, round, match, game, result } = input;
  const next = clone(ev);
  if (phase === "swiss") {
    if (ev.status !== "swiss")
      fail("Swiss results can only be changed while Swiss is running. Reopen the event or undo the cut.");
    const m = next.rounds[round]?.matches[match];
    if (!m) fail("No such match.");
    if (m.b === null) fail("A bye has no result to enter.");
    if (game === 2 && ev.format !== "double") fail("Single-sided rounds have one game.");
    if (game === 1) m.g1 = result;
    else m.g2 = result;
    return next;
  }

  if (ev.status !== "cut") fail("The cut is not running.");
  if (round !== next.cut.length - 1)
    fail("Only the current cut round can be changed. Undo later rounds first.");
  if (game !== 1) fail("Cut matches are single games.");
  const r = next.cut[round]!;
  const m = r.matches[match];
  if (!m) fail("No such match.");
  m.g1 = result;
  if (roundComplete(next, r, "cut")) {
    if (r.matches.length === 1) next.status = "done";
    else next.cut.push(nextCutRound(next.cut, r, cutSeeds(next, nameOf), rng));
  }
  return next;
}

export function startCut(ev: EventState, nameOf: NameOf, rng: Rng): EventState {
  if (nextStep(ev) !== "start-cut") fail("Finish all Swiss rounds before starting the cut.");
  const next = clone(ev);
  const first = firstCutRound(next, nameOf, rng);
  if (first.matches.length === 0) fail("Not enough players for a cut.");
  next.cut = [first];
  next.status = "cut";
  return next;
}

/** Finishes a Swiss-only event. */
export function finishEvent(ev: EventState): EventState {
  if (ev.status !== "swiss" || !swissFinished(ev) || ev.cutSize > 0) {
    fail("All Swiss rounds must be reported (and the event must have no cut) to finish.");
  }
  return { ...clone(ev), status: "done" };
}

/** Reopen a finished event: back to the cut if there is one, else Swiss. */
export function reopenEvent(ev: EventState): EventState {
  if (ev.status !== "done") fail("Only a finished event can be reopened.");
  return { ...clone(ev), status: ev.cut.length ? "cut" : "swiss" };
}

/** Reset a single event back to sign-up, keeping its entrants. */
export function resetEvent(ev: EventState): EventState {
  return { ...clone(ev), rounds: [], cut: [], status: "signup" };
}
