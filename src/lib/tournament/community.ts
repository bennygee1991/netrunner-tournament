import { BADGES } from "@/engine";
import type { PrismaClient } from "@/generated/prisma/client";
import { runnerNameKey } from "../validation";
import { loadBadges } from "./badges";

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
      featuredBadges: true,
      role: true,
      createdAt: true,
      _count: { select: { eventRecords: true } },
      eventRecords: { where: { champion: true }, select: { id: true } },
      trophies: { select: { kind: true } },
    },
    take: 500,
  });
  const summary = await loadBadges(db);
  const trophyBadges = new Set(BADGES.filter((b) => b.group === "trophy").map((b) => b.key));
  const rows = users.map((u) => {
    const earned = summary.byUser.get(u.id) ?? [];
    // Featured keys can go stale if a trophy is removed (an event reopened): show only held ones.
    const held = new Set([...earned.map((b) => b.key), ...u.trophies.map((t) => t.kind)]);
    return {
      id: u.id,
      runnerName: u.runnerName,
      avatar: u.avatar,
      bio: u.bio,
      featured: u.featuredBadges.filter((k) => held.has(k)),
      organizer: u.role === "ADMIN",
      events: u._count.eventRecords,
      titles: u.eventRecords.length,
      trophies: u.trophies.length + earned.filter((b) => trophyBadges.has(b.key)).length,
      badges: earned.filter((b) => !trophyBadges.has(b.key)).length,
    };
  });
  const byName = (a: (typeof rows)[number], b: (typeof rows)[number]) =>
    a.runnerName.localeCompare(b.runnerName);
  if (opts.sort === "events") rows.sort((a, b) => b.events - a.events || byName(a, b));
  else if (opts.sort === "trophies")
    rows.sort(
      (a, b) => b.trophies - a.trophies || b.titles - a.titles || b.badges - a.badges || byName(a, b),
    );
  else rows.sort(byName);
  return rows;
}

// Finale trophies are matched to event champions on season, event and player: archived events
// are deleted, so their trophies no longer carry an event id.
const finaleKey = (t: { seasonName: string; eventName: string | null; playerName: string }) =>
  `${t.seasonName}|${t.eventName}|${t.playerName}`;

export interface HallPlayer {
  name: string;
  /** Current runner name for a profile link, when the player has an active account. */
  profile: string | null;
  avatar: string | null;
  seed: string;
}

/** League-wide trophy cabinet: season podiums, month and event champions, and badge holders. */
export async function getHallOfChampions(db: PrismaClient) {
  const trophies = await db.trophy.findMany({ orderBy: { awardedAt: "desc" } });
  const userIds = [...new Set(trophies.map((t) => t.userId).filter((x): x is string => !!x))];
  const summary = await loadBadges(db);
  const allIds = [...new Set([...userIds, ...[...summary.holders.values()].flat()])];
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
      finaleKey: finaleKey(t),
      eventName: t.eventName ?? "Event",
      seasonName: t.seasonName,
      awardedAt: t.awardedAt,
      player: player(t.userId, t.playerName),
    }));

  const oneOffChampions = trophies
    .filter((t) => t.kind === "oneoff-champion")
    .map((t) => ({ id: t.id, eventName: t.eventName ?? "Event", player: player(t.userId, t.playerName) }));
  const monthChampions = trophies
    .filter((t) => t.kind === "month1-champion" || t.kind === "month2-champion")
    .map((t) => ({
      id: t.id,
      month: t.kind === "month1-champion" ? 1 : 2,
      seasonName: t.seasonName,
      player: player(t.userId, t.playerName),
    }));
  const finaleChampions = new Set(trophies.filter((t) => t.kind === "finale-champion").map(finaleKey));

  // Badges (accounts only; walk-ins have no permanent identity).
  const badges = BADGES.map((b) => {
    const holders = (summary.holders.get(b.key) ?? [])
      .map((id) => userById.get(id))
      .filter((u): u is NonNullable<typeof u> => !!u && !u.disabledAt)
      .map((u) => player(u.id, u.runnerName))
      .sort((x, y) => x.name.localeCompare(y.name));
    return { ...b, holders, of: summary.players };
  });

  return {
    seasons: [...seasons.values()],
    monthChampions,
    oneOffChampions,
    eventChampions: eventChampions.map((e) => ({ ...e, finale: finaleChampions.has(e.finaleKey) })),
    badges,
  };
}
