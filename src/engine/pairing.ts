import { PAIRING_NODE_BUDGET } from "./rules";
import { coinFlip, shuffle } from "./rng";
import { standings } from "./standings";
import type { EventState, Match, NameOf, Rng, Round } from "./types";

/** Unordered pair key. */
export function pairKey(a: string, b: string): string {
  return a < b ? `${a}|${b}` : `${b}|${a}`;
}

/**
 * Side bias per entrant for single-sided Swiss: Corp games minus Runner games.
 * Always 0 for double-sided events.
 */
export function sideBias(ev: EventState): Record<string, number> {
  const bias: Record<string, number> = {};
  for (const id of ev.entrants) bias[id] = 0;
  if (ev.format === "double") return bias;
  for (const round of ev.rounds) {
    for (const x of round.matches) {
      if (x.b === null || !x.corp) continue;
      const corp = x.corp === "a" ? x.a : x.b;
      const runner = x.corp === "a" ? x.b : x.a;
      bias[corp] = (bias[corp] ?? 0) + 1;
      bias[runner] = (bias[runner] ?? 0) - 1;
    }
  }
  return bias;
}

/** Which pass produced the pairings (for display / diagnostics). */
export type PairingMode = "strict" | "allow-side-clash" | "allow-rematch" | "sequential";

export interface PairingResult {
  round: Round;
  mode: PairingMode;
}

/**
 * Pairs the next Swiss round. Ported from prototype `pairRound()`:
 *  - order = current standings without dropped players; round 1 order is shuffled;
 *  - odd count: bye to the lowest-ranked player without a bye (else the lowest-ranked);
 *  - depth-first backtracking over that order with a node budget, passes:
 *    strict -> allow side clash -> allow rematch -> sequential;
 *  - sides: double-sided = coin flip for game 1 Corp; single-sided = lower Corp bias takes Corp,
 *    equal = coin flip.
 * The rng is consumed in exactly the same order as the prototype.
 */
export function pairRound(ev: EventState, nameOf: NameOf, rng: Rng): PairingResult {
  const double = ev.format === "double";
  const st = standings(ev, nameOf);
  const dropped = new Set(ev.dropped);
  let order = st.map((s) => s.id).filter((id) => !dropped.has(id));
  if (ev.rounds.length === 0) order = shuffle(order, rng);

  let bye: string | null = null;
  if (order.length % 2) {
    const byId = new Map(st.map((s) => [s.id, s]));
    for (let i = order.length - 1; i >= 0; i--) {
      if (!byId.get(order[i]!)!.byes) {
        bye = order[i]!;
        break;
      }
    }
    if (!bye) bye = order[order.length - 1]!;
    order = order.filter((x) => x !== bye);
  }

  const played = new Set<string>();
  for (const r of ev.rounds) for (const x of r.matches) if (x.b !== null) played.add(pairKey(x.a, x.b));

  const bias = sideBias(ev);
  let budget = 0;
  const clash = (a: string, b: string) =>
    !double && ((bias[a]! > 0 && bias[b]! > 0) || (bias[a]! < 0 && bias[b]! < 0));

  function solve(list: string[], allowRematch: boolean, allowSideClash: boolean): [string, string][] | null {
    if (!list.length) return [];
    if (--budget < 0) return null;
    const a = list[0]!;
    for (let i = 1; i < list.length; i++) {
      const b = list[i]!;
      if (!allowRematch && played.has(pairKey(a, b))) continue;
      if (!allowSideClash && clash(a, b)) continue;
      const rest = list.filter((_, j) => j !== 0 && j !== i);
      const r = solve(rest, allowRematch, allowSideClash);
      if (r) return [[a, b], ...r];
    }
    return null;
  }

  const passes: [PairingMode, boolean, boolean][] = [
    ["strict", false, false],
    ["allow-side-clash", false, true],
    ["allow-rematch", true, true],
  ];
  let pairs: [string, string][] | null = null;
  let mode: PairingMode = "sequential";
  for (const [m, allowRematch, allowSideClash] of passes) {
    budget = PAIRING_NODE_BUDGET;
    pairs = solve(order, allowRematch, allowSideClash);
    if (pairs) {
      mode = m;
      break;
    }
  }
  if (!pairs) {
    pairs = [];
    for (let k = 0; k + 1 < order.length; k += 2) pairs.push([order[k]!, order[k + 1]!]);
  }

  const matches: Match[] = pairs.map(([a, b]) => {
    let corp: "a" | "b";
    if (double) corp = coinFlip(rng);
    else if (bias[a]! < bias[b]!) corp = "a";
    else if (bias[a]! > bias[b]!) corp = "b";
    else corp = coinFlip(rng);
    return { a, b, corp, g1: null, g2: null };
  });
  if (bye) matches.push({ a: bye, b: null, corp: null, g1: "A", g2: null });
  return { round: { matches }, mode };
}
