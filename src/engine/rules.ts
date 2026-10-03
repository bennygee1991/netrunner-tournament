import type { Format } from "./types";

/**
 * Rule constants. The in-app Rules page renders from these so it cannot drift from the engine.
 * Source: reference/prototype.html, docs/SPEC.md section 4, NSG Organized Play Policies v1.6.2.
 */
export const GAME_POINTS = { win: 3, tie: 1, loss: 0 } as const;

/** A bye scores as winning every game in the round. */
export function byePoints(format: Format): number {
  return format === "double" ? 2 * GAME_POINTS.win : GAME_POINTS.win;
}

export const CUT_SIZES = [0, 4, 8] as const;
export const DEFAULT_CUT_SIZE = 4;
export const SWISS_ROUNDS_MIN = 1;
export const SWISS_ROUNDS_MAX = 9;

/** Pairing search budget (nodes) per fallback pass. */
export const PAIRING_NODE_BUDGET = 20000;

export const DEFAULT_ROUNDS = {
  single: { threshold: 16, below: 5, atOrAbove: 6 },
  double: { threshold: 12, below: 3, atOrAbove: 4 },
} as const;

/** Recommended Swiss rounds for `players`, capped at players - 1 (minimum 1). */
export function defaultSwissRounds(format: Format, players: number): number {
  const d = DEFAULT_ROUNDS[format];
  const rec = players < d.threshold ? d.below : d.atOrAbove;
  return Math.max(1, Math.min(rec, players - 1));
}

/** League points per event placing. */
export const EVENT_POINTS = {
  champion: 10,
  finalist: 7,
  top4: 5,
  top8: 3,
  played: 1,
} as const;

/** Swiss-only events: points by final Swiss rank, using the same table. */
export function pointsForSwissRank(rank: number): number {
  if (rank === 1) return EVENT_POINTS.champion;
  if (rank === 2) return EVENT_POINTS.finalist;
  if (rank <= 4) return EVENT_POINTS.top4;
  if (rank <= 8) return EVENT_POINTS.top8;
  return EVENT_POINTS.played;
}

export const SEASON = { events: 4, daysBetweenEvents: 14, eventsPerMonth: 2 } as const;

export const MILESTONES = {
  firstEvent: { key: "first-event", label: "Jacked in", description: "Played a first league event." },
  tenEvents: { key: "ten-events", label: "Veteran", description: "Played 10 league events.", count: 10 },
  undefeatedSwiss: {
    key: "undefeated-swiss",
    label: "Flawless Swiss",
    description: "Finished an event's Swiss rounds without losing a game.",
  },
} as const;
