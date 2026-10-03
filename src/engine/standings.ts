import { GAME_POINTS, byePoints } from "./rules";
import type { EventState, GameResult, Match, NameOf } from "./types";

export interface Standing {
  id: string;
  rank: number;
  points: number;
  wins: number;
  draws: number;
  losses: number;
  /** Opponents faced (byes excluded), in round order. */
  opponents: string[];
  byes: number;
  /** Single-sided Swiss only: games played as Corp / Runner. */
  corpGames: number;
  runnerGames: number;
  /** Strength of schedule. */
  sos: number;
  /** Extended strength of schedule. */
  esos: number;
}

/** Results that count for a Swiss match: g1 for single-sided, g1 + g2 for double-sided. */
export function swissGames(format: EventState["format"], m: Match): (GameResult | null)[] {
  return format === "double" ? [m.g1, m.g2] : [m.g1];
}

/** Corp entrant id for a match's game 1, or null. */
export function corpOf(m: Match): string | null {
  if (!m.corp || m.b === null) return null;
  return m.corp === "a" ? m.a : m.b;
}

/** Corp player for a given game: game 2 of a double-sided match swaps sides. */
export function corpForGame(m: Match, game: 1 | 2): string | null {
  if (!m.corp || m.b === null) return null;
  const side = game === 1 ? m.corp : m.corp === "a" ? "b" : "a";
  return side === "a" ? m.a : m.b;
}

/** Runner entrant id for a match's game 1, or null. */
export function runnerOf(m: Match): string | null {
  if (!m.corp || m.b === null) return null;
  return m.corp === "a" ? m.b : m.a;
}

/**
 * Swiss standings for an event (all entrants, dropped included).
 * Ported from prototype `standings()`:
 *  - win 3 / tie 1 / loss 0 per game; bye = win of every game in the round;
 *  - R = number of Swiss rounds so far (a bye round counts), a bye adds no opponent;
 *  - SoS = sum(opponent points / R) / R; extended SoS = mean of opponents' SoS;
 *  - order: points, SoS, extended SoS, then name.
 */
export function standings(ev: EventState, nameOf: NameOf): Standing[] {
  const double = ev.format === "double";
  const m = new Map<string, Standing>();
  for (const id of ev.entrants) {
    m.set(id, {
      id,
      rank: 0,
      points: 0,
      wins: 0,
      draws: 0,
      losses: 0,
      opponents: [],
      byes: 0,
      corpGames: 0,
      runnerGames: 0,
      sos: 0,
      esos: 0,
    });
  }

  for (const round of ev.rounds) {
    for (const x of round.matches) {
      if (x.b === null) {
        const s = m.get(x.a);
        if (s) {
          s.points += byePoints(ev.format);
          s.wins += double ? 2 : 1;
          s.byes++;
        }
        continue;
      }
      const a = m.get(x.a);
      const b = m.get(x.b);
      if (!a || !b) continue;
      a.opponents.push(x.b);
      b.opponents.push(x.a);
      if (!double && x.corp) {
        const corp = x.corp === "a" ? a : b;
        const runner = x.corp === "a" ? b : a;
        corp.corpGames++;
        runner.runnerGames++;
      }
      for (const g of swissGames(ev.format, x)) {
        if (g === "A") {
          a.points += GAME_POINTS.win;
          a.wins++;
          b.losses++;
        } else if (g === "B") {
          b.points += GAME_POINTS.win;
          b.wins++;
          a.losses++;
        } else if (g === "D") {
          a.points += GAME_POINTS.tie;
          b.points += GAME_POINTS.tie;
          a.draws++;
          b.draws++;
        }
      }
    }
  }

  // Same arithmetic order as the prototype so floating-point ties break identically.
  const R = ev.rounds.length || 1;
  const arr = [...m.values()];
  for (const s of arr) {
    s.sos = s.opponents.reduce((t, o) => t + (m.has(o) ? m.get(o)!.points / R : 0), 0) / R;
  }
  for (const s of arr) {
    s.esos = s.opponents.length
      ? s.opponents.reduce((t, o) => t + (m.has(o) ? m.get(o)!.sos : 0), 0) / s.opponents.length
      : 0;
  }
  arr.sort(
    (a, b) =>
      b.points - a.points || b.sos - a.sos || b.esos - a.esos || nameOf(a.id).localeCompare(nameOf(b.id)),
  );
  arr.forEach((s, i) => (s.rank = i + 1));
  return arr;
}
