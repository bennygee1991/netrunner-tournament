import { type BoardKey, type BoardRow, type EventState, eventsForBoard, leaderboard } from "@/engine";
import type { PrismaClient } from "@/generated/prisma/client";
import { runnerNameKey } from "../validation";
import { type Db, eventInclude, toLoaded } from "./state";

/**
 * Leaderboards aggregate across events, so entrants (one per event) are relabelled to a stable
 * player key: the account id, or the walk-in name for guests.
 */
export function playerKey(e: { userId: string | null; guestName: string | null }): string {
  return e.userId ? `u:${e.userId}` : `g:${runnerNameKey(e.guestName ?? "unknown")}`;
}

export function userIdFromKey(key: string): string | null {
  return key.startsWith("u:") ? key.slice(2) : null;
}

export function relabel(state: EventState, map: (id: string) => string): EventState {
  const m = (id: string) => map(id);
  return {
    ...state,
    entrants: state.entrants.map(m),
    dropped: state.dropped.map(m),
    rounds: state.rounds.map((r) => ({
      matches: r.matches.map((x) => ({ ...x, a: m(x.a), b: x.b && m(x.b) })),
    })),
    cut: state.cut.map((r) => ({ matches: r.matches.map((x) => ({ ...x, a: m(x.a), b: x.b && m(x.b) })) })),
  };
}

export interface SeasonBoards {
  events: { id: string; name: string; index: number; month: number; status: string }[];
  boards: Record<BoardKey, BoardRow[]>;
  nameOf: (key: string) => string;
}

/** Month 1, Month 2 and Season boards for a season, keyed by player. */
export async function seasonBoards(db: Db | PrismaClient, seasonId: string): Promise<SeasonBoards> {
  const rows = await db.event.findMany({
    where: { seasonId },
    include: eventInclude,
    orderBy: { index: "asc" },
  });
  const names = new Map<string, string>();
  const states = rows.map((row) => {
    const loaded = toLoaded(row);
    const keyOf = new Map(loaded.entrants.map((e) => [e.id, playerKey(e)]));
    for (const e of loaded.entrants) names.set(keyOf.get(e.id)!, e.name);
    return relabel(loaded.state, (id) => keyOf.get(id) ?? id);
  });
  const nameOf = (key: string) => names.get(key) ?? "Unknown";
  return {
    events: rows.map((r) => ({ id: r.id, name: r.name, index: r.index, month: r.month, status: r.status })),
    boards: {
      month1: leaderboard(eventsForBoard(states, "month1"), nameOf),
      month2: leaderboard(eventsForBoard(states, "month2"), nameOf),
      season: leaderboard(eventsForBoard(states, "season"), nameOf),
    },
    nameOf,
  };
}
