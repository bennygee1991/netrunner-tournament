import { MILESTONES, milestoneTrophies } from "@/engine";
import type { PrismaClient } from "@/generated/prisma/client";
import { runnerNameKey } from "../validation";

/** Public player directory: every active account with their avatar and headline numbers. */
export async function getPlayerDirectory(
  db: PrismaClient,
  opts: { q?: string; sort?: "name" | "events" | "trophies" },
) {
  const q = (opts.q ?? "").trim().toLowerCase().slice(0, 50);
  const users = await db.user.findMany({
    where: { disabledAt: null, ...(q ? { runnerNameLower: { contains: q } } : {}) },
    select: {
      id: true,
      runnerName: true,
      avatar: true,
      bio: true,
      role: true,
      createdAt: true,
      _count: { select: { eventRecords: true, trophies: true } },
      eventRecords: { where: { champion: true }, select: { id: true } },
    },
    take: 500,
  });
  const rows = users.map((u) => ({
    id: u.id,
    runnerName: u.runnerName,
    avatar: u.avatar,
    bio: u.bio,
    organizer: u.role === "ADMIN",
    events: u._count.eventRecords,
    titles: u.eventRecords.length,
    trophies: u._count.trophies,
  }));
  const byName = (a: (typeof rows)[number], b: (typeof rows)[number]) =>
    a.runnerName.localeCompare(b.runnerName);
  if (opts.sort === "events") rows.sort((a, b) => b.events - a.events || byName(a, b));
  else if (opts.sort === "trophies")
    rows.sort((a, b) => b.trophies - a.trophies || b.titles - a.titles || byName(a, b));
  else rows.sort(byName);
  return rows;
}

export interface HallPlayer {
  name: string;
  /** Current runner name for a profile link, when the player has an active account. */
  profile: string | null;
  avatar: string | null;
  seed: string;
}

/** League-wide trophy cabinet: season podiums, event champions and milestone holders. */
export async function getHallOfChampions(db: PrismaClient) {
  const trophies = await db.trophy.findMany({ orderBy: { awardedAt: "desc" } });
  const userIds = [...new Set(trophies.map((t) => t.userId).filter((x): x is string => !!x))];
  const milestoneRows = await db.eventRecord.groupBy({
    by: ["userId"],
    where: { userId: { not: null } },
    _count: { _all: true },
  });
  const undefeated = await db.eventRecord.groupBy({
    by: ["userId"],
    where: { userId: { not: null }, undefeated: true },
    _count: { _all: true },
  });
  const allIds = [...new Set([...userIds, ...milestoneRows.map((r) => r.userId!)])];
  const users = await db.user.findMany({
    where: { id: { in: allIds } },
    select: { id: true, runnerName: true, avatar: true, disabledAt: true },
  });
  const userById = new Map(users.map((u) => [u.id, u]));
  const player = (userId: string | null, fallbackName: string): HallPlayer => {
    const u = userId ? userById.get(userId) : undefined;
    return {
      name: u?.runnerName ?? fallbackName,
      profile: u && !u.disabledAt ? u.runnerName : null,
      avatar: u?.avatar ?? null,
      // Same seed as the leaderboards (player key without the "u:" prefix) so avatars match.
      seed: userId ?? `g:${runnerNameKey(fallbackName)}`,
    };
  };

  // Season podiums, grouped by season (newest first).
  const seasons = new Map<
    string,
    { seasonName: string; awardedAt: Date; places: { kind: string; player: HallPlayer }[] }
  >();
  const placeOrder: Record<string, number> = { "season-champion": 1, "season-second": 2, "season-third": 3 };
  for (const t of trophies.filter((x) => x.kind in placeOrder)) {
    const key = t.seasonId ?? t.seasonName;
    const s = seasons.get(key) ?? { seasonName: t.seasonName, awardedAt: t.awardedAt, places: [] };
    s.places.push({ kind: t.kind, player: player(t.userId, t.playerName) });
    seasons.set(key, s);
  }
  for (const s of seasons.values()) s.places.sort((a, b) => placeOrder[a.kind]! - placeOrder[b.kind]!);

  const eventChampions = trophies
    .filter((t) => t.kind === "event-champion")
    .map((t) => ({
      id: t.id,
      eventName: t.eventName ?? "Event",
      seasonName: t.seasonName,
      awardedAt: t.awardedAt,
      player: player(t.userId, t.playerName),
    }));

  // Milestones (accounts only; walk-ins have no permanent identity).
  const undefeatedBy = new Map(undefeated.map((r) => [r.userId!, r._count._all]));
  const holders: Record<string, HallPlayer[]> = {};
  for (const m of Object.values(MILESTONES)) holders[m.key] = [];
  for (const r of milestoneRows) {
    const u = userById.get(r.userId!);
    if (!u || u.disabledAt) continue;
    for (const kind of milestoneTrophies({
      eventsPlayed: r._count._all,
      undefeatedSwissRuns: undefeatedBy.get(r.userId!) ?? 0,
    })) {
      holders[kind]!.push(player(r.userId, u.runnerName));
    }
  }
  for (const list of Object.values(holders)) list.sort((a, b) => a.name.localeCompare(b.name));
  const milestones = Object.values(MILESTONES).map((m) => ({
    key: m.key,
    label: m.label,
    description: m.description,
    holders: holders[m.key]!,
  }));

  return { seasons: [...seasons.values()], eventChampions, milestones };
}
