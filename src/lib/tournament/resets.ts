import { seasonTrophies } from "@/engine";
import type { PrismaClient } from "@/generated/prisma/client";
import { type Actor, audit } from "../audit";
import { seasonBoards, userIdFromKey } from "./boards";
import { readPrizes } from "./season";

type Result = { ok: true; message: string } | { ok: false; error: string };

export interface SnapshotRow {
  key: string;
  userId: string | null;
  name: string;
  rank: number;
  total: number;
  titles: number;
  played: number;
}

const TROPHY_LABEL = { "season-champion": 1, "season-second": 2, "season-third": 3 } as const;

/**
 * End of season: freeze the three boards (names, points, prize text) into Past seasons, award the
 * season podium trophies, then clear the season's events, results and sign-ups. Accounts and
 * permanent event records are kept. Requires typing the season name.
 */
export async function archiveSeason(
  db: PrismaClient,
  actor: Actor,
  seasonId: unknown,
  confirmation: unknown,
): Promise<Result> {
  const season =
    typeof seasonId === "string" && seasonId.length <= 64
      ? await db.season.findUnique({ where: { id: seasonId } })
      : null;
  if (!season || season.status !== "ACTIVE") return { ok: false, error: "No active season to archive." };
  if (typeof confirmation !== "string" || confirmation.trim() !== season.name) {
    return { ok: false, error: `Type the season name "${season.name}" exactly to confirm.` };
  }

  const { boards, events, nameOf } = await seasonBoards(db, season.id);
  const prizes = readPrizes(season.prizesJson);
  const toRows = (rows: (typeof boards)["season"]): SnapshotRow[] =>
    rows.map((r) => ({
      key: r.id,
      userId: userIdFromKey(r.id),
      name: nameOf(r.id),
      rank: r.rank,
      total: r.total,
      titles: r.titles,
      played: r.played,
    }));
  const snapshot = {
    month1: { prize: prizes.month1, rows: toRows(boards.month1) },
    month2: { prize: prizes.month2, rows: toRows(boards.month2) },
    season: { prize: prizes.season, rows: toRows(boards.season) },
  };
  const podium = seasonTrophies(boards.season);
  const unfinished = events.filter((e) => e.status !== "DONE").length;

  await db.$transaction(async (tx) => {
    for (const [boardKey, data] of Object.entries(snapshot)) {
      await tx.leaderboardSnapshot.create({
        data: { seasonId: season.id, boardKey, rowsJson: JSON.parse(JSON.stringify(data)) },
      });
    }
    for (const t of podium) {
      await tx.trophy.create({
        data: {
          kind: t.kind,
          userId: userIdFromKey(t.playerId),
          playerName: nameOf(t.playerId),
          seasonId: season.id,
          seasonName: season.name,
        },
      });
    }
    await tx.event.deleteMany({ where: { seasonId: season.id } });
    await tx.season.update({
      where: { id: season.id },
      data: { status: "ARCHIVED", archivedAt: new Date() },
    });
    await audit(tx, actor, "season.archive", {
      seasonId: season.id,
      name: season.name,
      events: events.length,
      unfinishedEvents: unfinished,
      podium: podium.map((t) => ({
        place: TROPHY_LABEL[t.kind as keyof typeof TROPHY_LABEL],
        player: nameOf(t.playerId),
      })),
      before: "ACTIVE",
      after: "ARCHIVED",
    });
  });
  return { ok: true, message: `${season.name} archived to Past seasons. Ready for a new season.` };
}

/**
 * Wipes every season, event, result, past season, trophy and sign-up. Accounts are kept unless
 * `deleteAccounts` is set, in which case every non-admin account is deleted. The audit log is kept.
 * Requires typing RESET.
 */
export async function resetEverything(
  db: PrismaClient,
  actor: Actor,
  confirmation: unknown,
  deleteAccounts: boolean,
): Promise<Result> {
  if (confirmation !== "RESET") return { ok: false, error: "Type RESET (in capitals) to confirm." };
  const counts = await db.$transaction(async (tx) => {
    const seasons = await tx.season.count();
    const records = await tx.eventRecord.deleteMany({});
    const trophies = await tx.trophy.deleteMany({});
    await tx.season.deleteMany({}); // cascades events, entrants, sign-ups, rounds, matches, snapshots
    await tx.signup.deleteMany({});
    const accounts = deleteAccounts ? await tx.user.deleteMany({ where: { role: "PLAYER" } }) : { count: 0 };
    await audit(tx, actor, "system.reset_all", {
      seasons,
      eventRecords: records.count,
      trophies: trophies.count,
      accountsDeleted: accounts.count,
      deleteAccounts,
    });
    return { seasons, accounts: accounts.count };
  });
  return {
    ok: true,
    message: `Everything was reset (${counts.seasons} season${counts.seasons === 1 ? "" : "s"} removed${
      deleteAccounts ? `, ${counts.accounts} player accounts deleted` : ", accounts kept"
    }).`,
  };
}
