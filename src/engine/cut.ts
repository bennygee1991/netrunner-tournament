import { coinFlip } from "./rng";
import { standings } from "./standings";
import type { EventState, Match, NameOf, Rng, Round, Side } from "./types";

/** Bracket seed order, e.g. 8 -> [1, 8, 4, 5, 2, 7, 3, 6]. */
export function seedOrder(n: number): number[] {
  if (n <= 2) return [1, 2];
  const out: number[] = [];
  for (const s of seedOrder(n / 2)) out.push(s, n + 1 - s);
  return out;
}

/**
 * Cut size that fits the field: halve until it fits, below 4 means no cut
 * (prototype `startswiss`: top 8 with 7 players -> top 4; 3 players -> none).
 */
export function effectiveCutSize(cutSize: number, players: number): number {
  let c = cutSize;
  while (c > players) c /= 2;
  return c < 4 ? 0 : c;
}

/** Cut side bias: Corp games minus Runner games, counted over cut rounds only. */
export function cutBias(cut: readonly Round[]): Record<string, number> {
  const b: Record<string, number> = {};
  for (const r of cut) {
    for (const x of r.matches) {
      if (!x.corp || x.b === null) continue;
      const corp = x.corp === "a" ? x.a : x.b;
      const runner = x.corp === "a" ? x.b : x.a;
      b[corp] = (b[corp] ?? 0) + 1;
      b[runner] = (b[runner] ?? 0) - 1;
    }
  }
  return b;
}

/**
 * Cut sides (prototype `cutSide()`): if A has played more Corp in the cut and B has not, B is Corp;
 * mirror for B; otherwise a coin flip (always a coin flip in the first cut round).
 */
export function cutSide(cut: readonly Round[], a: string, b: string, rng: Rng): Side {
  const cb = cutBias(cut);
  const ba = cb[a] ?? 0;
  const bb = cb[b] ?? 0;
  if (ba > 0 && bb <= 0) return "b";
  if (bb > 0 && ba <= 0) return "a";
  return coinFlip(rng);
}

/** Seed (1 = best) of every player in the cut, from final Swiss standings. */
export function cutSeeds(ev: EventState, nameOf: NameOf): Map<string, number> {
  const seeds = new Map<string, number>();
  cutSeedIds(ev, nameOf).forEach((id, i) => seeds.set(id, i + 1));
  return seeds;
}

/**
 * Players who make the cut, best seed first. Dropped players do not make the cut
 * (the cut is a future pairing); the next player moves up.
 */
export function cutSeedIds(ev: EventState, nameOf: NameOf): string[] {
  const dropped = new Set(ev.dropped);
  const eligible = standings(ev, nameOf)
    .map((s) => s.id)
    .filter((id) => !dropped.has(id));
  const n = effectiveCutSize(ev.cutSize, eligible.length);
  return eligible.slice(0, n);
}

/** First cut round in bracket order (1v8, 4v5, 2v7, 3v6), sides random. */
export function firstCutRound(ev: EventState, nameOf: NameOf, rng: Rng): Round {
  const seeds = cutSeedIds(ev, nameOf);
  const n = seeds.length;
  const order = seedOrder(n);
  const matches: Match[] = [];
  for (let i = 0; i < n; i += 2) {
    const a = seeds[order[i]! - 1]!;
    const b = seeds[order[i + 1]! - 1]!;
    // Sides in the first cut round are always random (no earlier cut games).
    matches.push({ a, b, corp: cutSide([], a, b, rng), g1: null, g2: null });
  }
  return { matches };
}

/**
 * Winner of a cut game. A tie advances the higher seed (Rules page; NSG cut games cannot end
 * tied in practice, the organizer records the higher seed if it happens).
 */
export function cutWinner(m: Match, seeds: Map<string, number>): string | null {
  if (m.b === null) return m.a;
  if (m.g1 === "A") return m.a;
  if (m.g1 === "B") return m.b;
  if (m.g1 === "D") {
    const sa = seeds.get(m.a) ?? Infinity;
    const sb = seeds.get(m.b) ?? Infinity;
    return sa <= sb ? m.a : m.b;
  }
  return null;
}

export function cutLoser(m: Match, seeds: Map<string, number>): string | null {
  const w = cutWinner(m, seeds);
  if (w === null || m.b === null) return null;
  return w === m.a ? m.b : m.a;
}

/** Next cut round from the winners of `prev`, paired in bracket order, sides per cut rules. */
export function nextCutRound(
  prior: readonly Round[],
  prev: Round,
  seeds: Map<string, number>,
  rng: Rng,
): Round {
  const winners = prev.matches.map((m) => cutWinner(m, seeds)!);
  const matches: Match[] = [];
  for (let i = 0; i < winners.length; i += 2) {
    const a = winners[i]!;
    const b = winners[i + 1]!;
    matches.push({ a, b, corp: cutSide(prior, a, b, rng), g1: null, g2: null });
  }
  return { matches };
}

export function cutRoundLabel(matches: number): string {
  if (matches === 1) return "Final";
  if (matches === 2) return "Semifinals";
  if (matches === 4) return "Quarterfinals";
  return `Round of ${matches * 2}`;
}
