import { leaderboard, eventResults, type BoardRow } from "./points";
import { MILESTONES, SEASON } from "./rules";
import { standings } from "./standings";
import type { EventState, NameOf } from "./types";

export interface PlannedEvent {
  index: number;
  name: string;
  /** YYYY-MM-DD */
  date: string;
  month: 1 | 2;
}

/** Adds days to a YYYY-MM-DD date (calendar arithmetic, no time zone involved). */
export function addDays(isoDate: string, days: number): string {
  const [y, m, d] = isoDate.split("-").map(Number) as [number, number, number];
  const t = new Date(Date.UTC(y, m - 1, d + days));
  return t.toISOString().slice(0, 10);
}

/** A season is 4 events two weeks apart: events 1-2 are Month 1, events 3-4 are Month 2. */
export function planSeason(firstEventDate: string): PlannedEvent[] {
  return Array.from({ length: SEASON.events }, (_, i) => ({
    index: i + 1,
    name: `Event ${i + 1}`,
    date: addDays(firstEventDate, SEASON.daysBetweenEvents * i),
    month: i < SEASON.eventsPerMonth ? 1 : 2,
  }));
}

export type BoardKey = "month1" | "month2" | "season";

export function eventsForBoard(events: readonly EventState[], key: BoardKey): EventState[] {
  if (key === "season") return [...events];
  const month = key === "month1" ? 1 : 2;
  return events.filter((e) => e.month === month);
}

export interface SnapshotRow {
  id: string;
  name: string;
  rank: number;
  total: number;
  titles: number;
  played: number;
}

/** Frozen boards for Past seasons (names and points), written when a season is archived. */
export function seasonSnapshot(
  events: readonly EventState[],
  nameOf: NameOf,
): Record<BoardKey, SnapshotRow[]> {
  const toRows = (rows: BoardRow[]): SnapshotRow[] =>
    rows.map((r) => ({
      id: r.id,
      name: nameOf(r.id),
      rank: r.rank,
      total: r.total,
      titles: r.titles,
      played: r.played,
    }));
  return {
    month1: toRows(leaderboard(eventsForBoard(events, "month1"), nameOf)),
    month2: toRows(leaderboard(eventsForBoard(events, "month2"), nameOf)),
    season: toRows(leaderboard(eventsForBoard(events, "season"), nameOf)),
  };
}

export type TrophyKind =
  | "season-champion"
  | "season-second"
  | "season-third"
  | "event-champion"
  | (typeof MILESTONES)[keyof typeof MILESTONES]["key"];

export interface TrophyAward {
  playerId: string;
  kind: TrophyKind;
}

/** Season podium trophies from the season board; shared ranks share the trophy. */
export function seasonTrophies(
  seasonRows: readonly { id: string; rank: number; total: number }[],
): TrophyAward[] {
  const kinds: Record<number, TrophyKind> = { 1: "season-champion", 2: "season-second", 3: "season-third" };
  return seasonRows
    .filter((r) => r.rank <= 3 && r.total > 0)
    .map((r) => ({ playerId: r.id, kind: kinds[r.rank]! }));
}

/** Event champion of a finished event (the player whose placing is Champion). */
export function eventChampion(ev: EventState, nameOf: NameOf): string | null {
  if (ev.status !== "done") return null;
  for (const [id, r] of eventResults(ev, nameOf)) if (r.label === "Champion") return id;
  return null;
}

/** Players who finished the event's Swiss without losing a game (at least one game played, not counting byes). */
export function undefeatedInSwiss(ev: EventState, nameOf: NameOf): string[] {
  if (ev.status !== "done") return [];
  return standings(ev, nameOf)
    .filter((s) => s.losses === 0 && s.opponents.length > 0)
    .map((s) => s.id);
}

/** Milestone trophies earned given a player's all-time record. */
export function milestoneTrophies(record: {
  eventsPlayed: number;
  undefeatedSwissRuns: number;
}): TrophyKind[] {
  const out: TrophyKind[] = [];
  if (record.eventsPlayed >= 1) out.push(MILESTONES.firstEvent.key);
  if (record.eventsPlayed >= MILESTONES.tenEvents.count) out.push(MILESTONES.tenEvents.key);
  if (record.undefeatedSwissRuns >= 1) out.push(MILESTONES.undefeatedSwiss.key);
  return out;
}
