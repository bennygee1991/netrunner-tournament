import { cutLoser, cutSeeds, cutWinner } from "./cut";
import { EVENT_POINTS, pointsForSwissRank } from "./rules";
import { standings } from "./standings";
import type { EventState, NameOf } from "./types";

export type PlacingLabel = "Champion" | "Finalist" | "Top 4" | "Top 8" | `Rank ${number}`;

export interface EventResult {
  points: number;
  label: PlacingLabel;
  /** Placing used for ordering (cut losers share a placing: 3 for top 4, 5 for top 8). */
  rank: number;
}

/**
 * League points from one event (prototype `eventResults()`):
 *  - every entrant gets 1 ("played"), labelled with their Swiss rank;
 *  - with a cut: champion 10, finalist 7, semi-final losers 5, quarter-final losers 3;
 *  - Swiss only: by final Swiss rank, 1st 10, 2nd 7, 3rd-4th 5, 5th-8th 3; rank 1 is the champion.
 */
export function eventResults(ev: EventState, nameOf: NameOf): Map<string, EventResult> {
  const out = new Map<string, EventResult>();
  const st = standings(ev, nameOf);
  for (const s of st) out.set(s.id, { points: EVENT_POINTS.played, label: `Rank ${s.rank}`, rank: s.rank });

  if (ev.cutSize > 0 && ev.cut.length) {
    const seeds = cutSeeds(ev, nameOf);
    for (const r of ev.cut) {
      const n = r.matches.length;
      for (const m of r.matches) {
        const w = cutWinner(m, seeds);
        const l = cutLoser(m, seeds);
        if (w === null || l === null) continue;
        if (n === 1) {
          out.set(w, { points: EVENT_POINTS.champion, label: "Champion", rank: 1 });
          out.set(l, { points: EVENT_POINTS.finalist, label: "Finalist", rank: 2 });
        } else if (n === 2) {
          out.set(l, { points: EVENT_POINTS.top4, label: "Top 4", rank: 3 });
        } else if (n === 4) {
          out.set(l, { points: EVENT_POINTS.top8, label: "Top 8", rank: 5 });
        }
      }
    }
  } else {
    for (const s of st) {
      const r = out.get(s.id)!;
      r.points = pointsForSwissRank(s.rank);
      if (s.rank === 1) r.label = "Champion";
    }
  }
  const multiplier = ev.pointsMultiplier ?? 1;
  if (multiplier !== 1) for (const r of out.values()) r.points *= multiplier;
  return out;
}

export interface BoardRow {
  id: string;
  rank: number;
  total: number;
  /** Event wins (Champion placings). */
  titles: number;
  played: number;
  byEvent: Record<string, EventResult>;
  byMonth: Record<1 | 2, number>;
}

/**
 * Leaderboard over a set of events (prototype `board()`): only finished events count.
 * Sorted by total, then titles, then name; equal total and titles share a rank.
 */
export function leaderboard(events: readonly EventState[], nameOf: NameOf): BoardRow[] {
  const rows = new Map<string, BoardRow>();
  for (const ev of events) {
    if (ev.status !== "done") continue;
    for (const [id, res] of eventResults(ev, nameOf)) {
      let r = rows.get(id);
      if (!r) {
        r = { id, rank: 0, total: 0, titles: 0, played: 0, byEvent: {}, byMonth: { 1: 0, 2: 0 } };
        rows.set(id, r);
      }
      r.total += res.points;
      r.played++;
      r.byEvent[ev.id] = res;
      r.byMonth[ev.month] = (r.byMonth[ev.month] || 0) + res.points;
      if (res.label === "Champion") r.titles++;
    }
  }
  const arr = [...rows.values()];
  arr.sort((a, b) => b.total - a.total || b.titles - a.titles || nameOf(a.id).localeCompare(nameOf(b.id)));
  arr.forEach((r, i) => {
    const prev = arr[i - 1];
    r.rank = prev && prev.total === r.total && prev.titles === r.titles ? prev.rank : i + 1;
  });
  return arr;
}
