import { MILESTONES, milestoneTrophies } from "@/engine";
import type { PrismaClient } from "@/generated/prisma/client";
import { runnerNameKey } from "../validation";
import { seasonBoards } from "./boards";

export const TROPHY_INFO: Record<string, { label: string; icon: string; order: number }> = {
  "season-champion": { label: "Season champion", icon: "🏆", order: 1 },
  "season-second": { label: "Season runner-up", icon: "🥈", order: 2 },
  "season-third": { label: "Season 3rd place", icon: "🥉", order: 3 },
  "event-champion": { label: "Event champion", icon: "⭐", order: 4 },
  [MILESTONES.tenEvents.key]: { label: MILESTONES.tenEvents.label, icon: "🎖️", order: 5 },
  [MILESTONES.undefeatedSwiss.key]: { label: MILESTONES.undefeatedSwiss.label, icon: "🛡️", order: 6 },
  [MILESTONES.firstEvent.key]: { label: MILESTONES.firstEvent.label, icon: "🔌", order: 7 },
};

const MILESTONE_DESCRIPTIONS: Record<string, string> = Object.fromEntries(
  Object.values(MILESTONES).map((m) => [m.key, m.description]),
);

export interface ProfileTrophy {
  kind: string;
  label: string;
  icon: string;
  detail: string;
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
    },
  });
  if (!user || user.disabledAt) return null;

  const [records, trophies, season] = await Promise.all([
    db.eventRecord.findMany({
      where: { userId: user.id },
      orderBy: [{ eventDate: "desc" }, { createdAt: "desc" }],
    }),
    db.trophy.findMany({ where: { userId: user.id }, orderBy: { awardedAt: "desc" } }),
    db.season.findFirst({ where: { status: "ACTIVE" }, select: { id: true, name: true } }),
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

  const cabinet: ProfileTrophy[] = trophies.map((t) => ({
    kind: t.kind,
    label: TROPHY_INFO[t.kind]?.label ?? t.kind,
    icon: TROPHY_INFO[t.kind]?.icon ?? "🏅",
    detail: t.eventName ? `${t.eventName} · ${t.seasonName}` : t.seasonName,
  }));
  for (const kind of milestoneTrophies({
    eventsPlayed: stats.events,
    undefeatedSwissRuns: stats.undefeatedRuns,
  })) {
    cabinet.push({
      kind,
      label: TROPHY_INFO[kind]!.label,
      icon: TROPHY_INFO[kind]!.icon,
      detail: MILESTONE_DESCRIPTIONS[kind] ?? "",
    });
  }
  cabinet.sort((a, b) => (TROPHY_INFO[a.kind]?.order ?? 9) - (TROPHY_INFO[b.kind]?.order ?? 9));

  let standing: { seasonName: string; rank: number; total: number; of: number } | null = null;
  if (season) {
    const { boards } = await seasonBoards(db, season.id);
    const row = boards.season.find((r) => r.id === `u:${user.id}`);
    if (row)
      standing = { seasonName: season.name, rank: row.rank, total: row.total, of: boards.season.length };
  }

  return { user, stats, cabinet, standing, records };
}
