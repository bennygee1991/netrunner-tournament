import { BADGES, type BadgeDef } from "@/engine";
import type { PrismaClient } from "@/generated/prisma/client";
import { runnerNameKey } from "../validation";
import { STORED_TROPHIES, loadBadges, rarity } from "./badges";
import { seasonBoards } from "./boards";

export interface ProfileTrophy {
  kind: string;
  label: string;
  icon: string;
  detail: string;
}

export interface ProfileBadge extends BadgeDef {
  /** Event where it was earned, when tied to one. */
  earnedAt: string | null;
  held: number;
  of: number;
}

/** Public profile: trophies, milestones, all-time stats, current season standing and history. */
export async function getProfile(db: PrismaClient, runnerName: string) {
  if (runnerName.length > 64) return null;
  const user = await db.user.findUnique({
    where: { runnerNameLower: runnerNameKey(runnerName) },
    select: {
      id: true,
      runnerName: true,
      bio: true,
      avatar: true,
      role: true,
      createdAt: true,
      disabledAt: true,
      featuredBadges: true,
    },
  });
  if (!user || user.disabledAt) return null;

  const [records, trophies, season, summary] = await Promise.all([
    db.eventRecord.findMany({
      where: { userId: user.id },
      orderBy: [{ eventDate: "desc" }, { createdAt: "desc" }],
    }),
    db.trophy.findMany({ where: { userId: user.id }, orderBy: { awardedAt: "desc" } }),
    db.season.findFirst({ where: { status: "ACTIVE" }, select: { id: true, name: true } }),
    loadBadges(db),
  ]);

  const stats = {
    events: records.length,
    titles: records.filter((r) => r.champion).length,
    leaguePoints: records.reduce((t, r) => t + r.points, 0),
    wins: records.reduce((t, r) => t + r.wins, 0),
    draws: records.reduce((t, r) => t + r.draws, 0),
    losses: records.reduce((t, r) => t + r.losses, 0),
    undefeatedRuns: records.filter((r) => r.undefeated).length,
  };

  const eventName = new Map(records.map((r) => [r.eventKey, `${r.eventName} · ${r.seasonName}`]));
  const earned = summary.byUser.get(user.id) ?? [];
  const earnedKeys = new Set(earned.map((b) => b.key));
  const toBadge = (b: BadgeDef): ProfileBadge => {
    const e = earned.find((x) => x.key === b.key);
    return {
      ...b,
      earnedAt: e?.eventKey ? (eventName.get(e.eventKey) ?? null) : null,
      ...rarity(summary, b.key),
    };
  };

  const cabinet: ProfileTrophy[] = trophies.map((t) => ({
    kind: t.kind,
    label: STORED_TROPHIES[t.kind]?.label ?? t.kind,
    icon: STORED_TROPHIES[t.kind]?.icon ?? "🏅",
    detail: t.eventName ? `${t.eventName} · ${t.seasonName}` : t.seasonName,
  }));
  cabinet.sort((a, b) => (STORED_TROPHIES[a.kind]?.order ?? 9) - (STORED_TROPHIES[b.kind]?.order ?? 9));
  for (const b of BADGES.filter((x) => x.group === "trophy" && earnedKeys.has(x.key))) {
    const pb = toBadge(b);
    cabinet.push({ kind: b.key, label: b.label, icon: b.icon, detail: pb.earnedAt ?? b.description });
  }
  const badges = BADGES.filter((b) => b.group !== "trophy" && earnedKeys.has(b.key)).map(toBadge);
  const locked = BADGES.filter((b) => !earnedKeys.has(b.key)).map(toBadge);
  const held = new Set([...earnedKeys, ...trophies.map((t) => t.kind)]);
  const featured = user.featuredBadges.filter((k) => held.has(k));

  let standing: { seasonName: string; rank: number; total: number; of: number } | null = null;
  if (season) {
    const { boards } = await seasonBoards(db, season.id);
    const row = boards.season.find((r) => r.id === `u:${user.id}`);
    if (row)
      standing = { seasonName: season.name, rank: row.rank, total: row.total, of: boards.season.length };
  }

  return { user, stats, cabinet, badges, locked, featured, standing, records };
}
