import {
  type EventState,
  type NameOf,
  type SeasonStanding,
  effectiveCutSize,
  finaleSeedOrder,
} from "@/engine";
import { playerKey, seasonBoards } from "./boards";
import type { Db, EntrantInfo } from "./state";

/** Season board standing (finished events so far) per player key. */
export async function seasonStandingsByPlayer(
  db: Db,
  seasonId: string,
): Promise<Map<string, SeasonStanding>> {
  const { boards } = await seasonBoards(db, seasonId);
  return new Map(boards.season.map((r) => [r.id, { total: r.total, titles: r.titles }]));
}

/** Season-seed order of a finale's entrants (season points, event wins, then the finale's Swiss rank). */
export function finaleOrder(
  state: EventState,
  nameOf: NameOf,
  entrants: EntrantInfo[],
  byPlayer: Map<string, SeasonStanding>,
): string[] {
  const keyOf = new Map(entrants.map((e) => [e.id, playerKey(e)]));
  return finaleSeedOrder(state, nameOf, (id) => byPlayer.get(keyOf.get(id) ?? ""));
}

export interface SeedingRow {
  id: string;
  name: string;
  seed: number;
  seasonTotal: number;
  inCut: boolean;
  dropped: boolean;
}

/** The finale's cut qualification table: fixed once the cut starts, projected before that. */
export function seedingTable(
  state: EventState,
  nameOf: NameOf,
  entrants: EntrantInfo[],
  byPlayer: Map<string, SeasonStanding>,
): SeedingRow[] {
  const order = state.cutSeedOrder?.length
    ? state.cutSeedOrder
    : finaleOrder(state, nameOf, entrants, byPlayer);
  const dropped = new Set(state.dropped);
  const eligible = order.filter((id) => !dropped.has(id));
  const cutCount = effectiveCutSize(state.cutSize, eligible.length);
  const inCut = new Set(eligible.slice(0, cutCount));
  const keyOf = new Map(entrants.map((e) => [e.id, playerKey(e)]));
  let seed = 0;
  return order.map((id) => ({
    id,
    name: nameOf(id),
    seed: dropped.has(id) ? 0 : ++seed,
    seasonTotal: byPlayer.get(keyOf.get(id) ?? "")?.total ?? 0,
    inCut: inCut.has(id),
    dropped: dropped.has(id),
  }));
}
