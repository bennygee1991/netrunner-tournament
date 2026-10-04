import type { PrismaClient } from "@/generated/prisma/client";
import { recordOutcome } from "./records";
import type { SnapshotRow } from "./resets";
import { eventInclude, toLoaded } from "./state";

/**
 * Brings permanent records written before badges existed up to date. Safe to run on every deploy:
 *  - finished events still in the database get their records rewritten with the full facts;
 *  - archived seasons get their month champion trophies from the frozen month boards.
 * Records of archived events keep what the migration could recover (no side wins or opponents).
 */
export async function backfillBadgeFacts(
  db: PrismaClient,
): Promise<{ events: number; monthTrophies: number }> {
  const stale = await db.eventRecord.findMany({
    where: { statsVersion: { lt: 2 }, eventId: { not: null } },
    distinct: ["eventId"],
    select: { eventId: true },
  });
  let events = 0;
  for (const { eventId } of stale) {
    const row = await db.event.findUnique({ where: { id: eventId! }, include: eventInclude });
    if (!row || row.status !== "DONE") continue;
    try {
      await db.$transaction((tx) => recordOutcome(tx, toLoaded(row)));
      events++;
    } catch (err) {
      // Never block a deploy over one event; its old records stay as they were.
      console.warn(`Badges: could not update event ${row.id}:`, err instanceof Error ? err.message : err);
    }
  }

  let monthTrophies = 0;
  const snaps = await db.leaderboardSnapshot.findMany({
    where: { boardKey: { in: ["month1", "month2"] } },
    include: { season: { select: { name: true } } },
  });
  for (const snap of snaps) {
    const kind = snap.boardKey === "month1" ? "month1-champion" : "month2-champion";
    if (await db.trophy.count({ where: { seasonId: snap.seasonId, kind } })) continue;
    const { rows } = snap.rowsJson as unknown as { rows: SnapshotRow[] };
    for (const r of rows.filter((x) => x.rank === 1 && x.total > 0)) {
      const exists = r.userId ? (await db.user.count({ where: { id: r.userId } })) > 0 : false;
      await db.trophy.create({
        data: {
          kind,
          userId: exists ? r.userId : null,
          playerName: r.name,
          seasonId: snap.seasonId,
          seasonName: snap.season.name,
          awardedAt: snap.createdAt,
        },
      });
      monthTrophies++;
    }
  }
  return { events, monthTrophies };
}
