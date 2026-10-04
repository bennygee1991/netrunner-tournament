/**
 * Tournament engine types. Ported from reference/prototype.html.
 * Player ids are opaque strings (entrant ids in the app).
 */

export type Format = "single" | "double";
/** Result of one game: A won, B won, or D (draw/tie). */
export type GameResult = "A" | "B" | "D";
/** Which side of a match is Corp in game 1 ("a" or "b"). */
export type Side = "a" | "b";
export type EventStatus = "signup" | "swiss" | "cut" | "done";
export type Phase = "swiss" | "cut";

/**
 * One pairing. `b === null` is a bye (scored as winning every game).
 * Single-sided Swiss and single-game cut matches use `g1` only. Double-sided Swiss uses `g1` and
 * `g2`, with sides swapped in game 2. Series cut matches use `g1`, `g2` (sides swapped) and, when
 * level after two games, `g3` with Corp `corp3`; `corp` stays null until the higher seed picks.
 */
export interface Match {
  a: string;
  b: string | null;
  corp: Side | null;
  g1: GameResult | null;
  g2: GameResult | null;
  /** Series cut matches only: deciding game 3 (played when games 1-2 leave the match level). */
  g3?: GameResult | null;
  /** Series cut matches only: Corp in game 3, set by a coin flip when the decider is needed. */
  corp3?: Side | null;
}

export interface Round {
  matches: Match[];
}

export interface EventState {
  id: string;
  month: 1 | 2;
  format: Format;
  status: EventStatus;
  entrants: string[];
  dropped: string[];
  /** Null/0 = use the default for the player count when Swiss starts. */
  swissRounds: number | null;
  /** 0, 4 or 8. */
  cutSize: number;
  rounds: Round[];
  cut: Round[];
  /** League points multiplier for this event (the season finale doubles points). Default 1. */
  pointsMultiplier?: number;
  /**
   * How cut matches are played. "single" (default, prototype): one game, sides by the cut rules.
   * "series" (league house rule): the higher seed picks sides for game 1, sides swap for game 2,
   * and a coin flip sets sides for a deciding game 3 if the match is level.
   */
  cutFormat?: CutFormat;
}

export type CutFormat = "single" | "series";

/** Display name for a player id; used for the final, deterministic tiebreak. */
export type NameOf = (id: string) => string;

/** Random source returning a float in [0, 1). Injected so tests are repeatable. */
export type Rng = () => number;
