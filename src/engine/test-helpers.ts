import { newEvent } from "./event";
import type { EventState, GameResult, Match, NameOf, Round } from "./types";

/** Names are the ids themselves, so the name tiebreak is alphabetical by id. */
export const byId: NameOf = (id) => id;

export function match(
  a: string,
  b: string | null,
  g1: GameResult | null = null,
  corp: "a" | "b" | null = "a",
  g2: GameResult | null = null,
): Match {
  return b === null ? { a, b: null, corp: null, g1: "A", g2: null } : { a, b, corp, g1, g2 };
}

export function round(...matches: Match[]): Round {
  return { matches };
}

export function swissEvent(
  entrants: string[],
  rounds: Round[] = [],
  extra: Partial<EventState> = {},
): EventState {
  return newEvent({ id: "ev", entrants, rounds, status: "swiss", swissRounds: 5, cutSize: 0, ...extra });
}

export function players(n: number): string[] {
  return Array.from({ length: n }, (_, i) => `p${String(i + 1).padStart(2, "0")}`);
}
