import { BADGES, type BadgeGroup, type BadgeRecord, type EarnedBadge, computeBadges } from "@/engine";
import { z } from "zod";
import type { PrismaClient } from "@/generated/prisma/client";

/** Trophies stored when they are won (events, season archive). */
export const STORED_TROPHIES: Record<string, { label: string; icon: string; order: number }> = {
  "season-champion": { label: "Season champion", icon: "🏆", order: 1 },
  "season-second": { label: "Season runner-up", icon: "🥈", order: 2 },
  "season-third": { label: "Season 3rd place", icon: "🥉", order: 3 },
  "finale-champion": { label: "Finale champion", icon: "👑", order: 4 },
  "month1-champion": { label: "Month 1 champion", icon: "🗓️", order: 5 },
  "month2-champion": { label: "Month 2 champion", icon: "🗓️", order: 5 },
  "event-champion": { label: "Event champion", icon: "⭐", order: 6 },
  "oneoff-champion": { label: "One-off champion", icon: "🎪", order: 7 },
};

export const BADGE_GROUPS: { group: BadgeGroup; label: string }[] = [
  { group: "trophy", label: "Achievement trophies" },
  { group: "attendance", label: "Turning up" },
  { group: "results", label: "Playing well" },
  { group: "sides", label: "Corp and Runner" },
  { group: "oneoff", label: "One-off events" },
  { group: "community", label: "Community" },
];

/** Keys a player may feature next to their name: any badge, or a stored trophy kind they hold. */
export function featurableKeys(earned: readonly EarnedBadge[], trophyKinds: readonly string[]): string[] {
  return [...new Set([...trophyKinds, ...earned.map((b) => b.key)])];
}

export function iconOf(key: string): { icon: string; label: string } | null {
  const t = STORED_TROPHIES[key];
  if (t) return { icon: t.icon, label: t.label };
  const b = BADGES.find((x) => x.key === key);
  return b ? { icon: b.icon, label: b.label } : null;
}

export interface BadgeSummary {
  /** Earned badges per account (accounts only; walk-ins have no permanent identity). */
  byUser: Map<string, EarnedBadge[]>;
  /** Active accounts holding each badge. */
  holders: Map<string, string[]>;
  /** Active accounts with at least one finished event (the rarity denominator). */
  players: number;
}

/** Works out every account's badges from the permanent event records. */
export async function loadBadges(db: PrismaClient): Promise<BadgeSummary> {
  const [records, titles, users] = await Promise.all([
    db.eventRecord.findMany({
      orderBy: [{ eventDate: "asc" }, { createdAt: "asc" }],
      select: {
        userId: true,
        eventKey: true,
        seasonId: true,
        seasonName: true,
        rank: true,
        champion: true,
        undefeated: true,
        wins: true,
        draws: true,
        losses: true,
        madeCut: true,
        cutSeed: true,
        cutSize: true,
        cutDraws: true,
        cutLosses: true,
        lostFirstRound: true,
        corpWins: true,
        runnerWins: true,
        opponentIds: true,
        oneOff: true,
      },
    }),
    db.trophy.groupBy({
      by: ["userId"],
      where: { kind: "season-champion", userId: { not: null } },
      _count: { _all: true },
    }),
    db.user.findMany({ where: { disabledAt: null }, select: { id: true, reportsApproved: true } }),
  ]);

  const eventOrder: string[] = [];
  const seasonOrder: string[] = [];
  const seenEvents = new Set<string>();
  const seenSeasons = new Set<string>();
  const byUserRecords = new Map<string, BadgeRecord[]>();
  for (const r of records) {
    const seasonKey = r.seasonId ?? r.seasonName;
    // One-off events are outside the league order (no seasons, no back-to-back).
    if (!r.oneOff && !seenEvents.has(r.eventKey)) {
      seenEvents.add(r.eventKey);
      eventOrder.push(r.eventKey);
    }
    if (!r.oneOff && !seenSeasons.has(seasonKey)) {
      seenSeasons.add(seasonKey);
      seasonOrder.push(seasonKey);
    }
    if (!r.userId) continue;
    const list = byUserRecords.get(r.userId) ?? [];
    list.push({ ...r, seasonKey });
    byUserRecords.set(r.userId, list);
  }
  const titlesBy = new Map(titles.map((t) => [t.userId!, t._count._all]));

  const byUser = new Map<string, EarnedBadge[]>();
  const holders = new Map<string, string[]>(BADGES.map((b) => [b.key, []]));
  let players = 0;
  for (const u of users) {
    const recs = byUserRecords.get(u.id) ?? [];
    if (recs.length) players++;
    const earned = computeBadges(
      { records: recs, seasonTitles: titlesBy.get(u.id) ?? 0, reportsApproved: u.reportsApproved },
      { eventOrder, seasonOrder },
    );
    if (!earned.length) continue;
    byUser.set(u.id, earned);
    for (const b of earned) holders.get(b.key)!.push(u.id);
  }
  return { byUser, holders, players };
}

/** "Held by 3 of 40 players" style rarity. */
export function rarity(summary: BadgeSummary, key: string): { held: number; of: number } {
  return { held: summary.holders.get(key)?.length ?? 0, of: summary.players };
}

export const FEATURED_MAX = 3;

/** Everything a player can feature: stored trophy kinds they hold and badges they earned. */
export async function heldKeys(db: PrismaClient, userId: string): Promise<string[]> {
  const [summary, trophies] = await Promise.all([
    loadBadges(db),
    db.trophy.findMany({ where: { userId }, select: { kind: true } }),
  ]);
  return featurableKeys(
    summary.byUser.get(userId) ?? [],
    trophies.map((t) => t.kind),
  );
}

const featuredInput = z.array(z.string().max(40)).max(FEATURED_MAX, `Pick at most ${FEATURED_MAX}.`);

/** Saves up to 3 featured trophies/badges; only ones the player actually holds. */
export async function setFeaturedBadges(db: PrismaClient, userId: string, raw: unknown) {
  const parsed = featuredInput.safeParse(raw);
  if (!parsed.success) return { ok: false as const, error: parsed.error.issues[0]!.message };
  const held = new Set(await heldKeys(db, userId));
  const keys = [...new Set(parsed.data)];
  if (keys.some((k) => !held.has(k)))
    return { ok: false as const, error: "You can only feature what you've earned." };
  await db.user.update({ where: { id: userId }, data: { featuredBadges: keys } });
  return { ok: true as const };
}

/** Trophies and badges earned at one event, per player (for the event page). */
export async function earnedAtEvent(db: PrismaClient, eventId: string) {
  const [summary, trophies, records] = await Promise.all([
    loadBadges(db),
    db.trophy.findMany({ where: { eventId }, select: { kind: true, userId: true, playerName: true } }),
    db.eventRecord.findMany({
      where: { eventKey: eventId },
      orderBy: { rank: "asc" },
      select: { userId: true, playerName: true, user: { select: { runnerName: true, disabledAt: true } } },
    }),
  ]);
  const out: {
    name: string;
    profile: string | null;
    items: { key: string; icon: string; label: string }[];
  }[] = [];
  for (const r of records) {
    const items = [
      ...trophies.filter((t) => t.userId && t.userId === r.userId).map((t) => t.kind),
      ...(r.userId ? (summary.byUser.get(r.userId) ?? []) : [])
        .filter((b) => b.eventKey === eventId)
        .map((b) => b.key),
    ].map((key) => ({ key, ...iconOf(key)! }));
    // Walk-ins can still win the event (stored trophy without an account).
    if (!r.userId) {
      for (const t of trophies.filter((x) => !x.userId && x.playerName === r.playerName))
        items.push({ key: t.kind, ...iconOf(t.kind)! });
    }
    if (!items.length) continue;
    out.push({
      name: r.user?.runnerName ?? r.playerName,
      profile: r.user && !r.user.disabledAt ? r.user.runnerName : null,
      items,
    });
  }
  return out;
}
