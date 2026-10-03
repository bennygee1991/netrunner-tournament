import type { BoardKey } from "@/engine";
import type { PrismaClient } from "@/generated/prisma/client";
import { seasonBoards, userIdFromKey } from "./boards";
import type { SnapshotRow } from "./resets";
import { readPrizes } from "./season";

export interface BoardView {
  key: BoardKey;
  title: string;
  prize: string;
  /** Column headers for per-event (month boards) or per-month (season board) points. */
  columns: { id: string; label: string }[];
  eventsDone: number;
  eventsTotal: number;
  rows: {
    key: string;
    name: string;
    /** Runner name for a profile link (accounts only). */
    profile: string | null;
    rank: number;
    total: number;
    titles: number;
    cells: (number | null)[];
  }[];
}

const TITLES: Record<BoardKey, string> = { month1: "Month 1", month2: "Month 2", season: "Season" };

/** The three live boards of the active season, ready to render. */
export async function getLiveBoards(db: PrismaClient) {
  const season = await db.season.findFirst({ where: { status: "ACTIVE" } });
  if (!season) return null;
  const { boards, events, nameOf } = await seasonBoards(db, season.id);
  const prizes = readPrizes(season.prizesJson);
  const users = await db.user.findMany({
    where: { id: { in: boards.season.map((r) => userIdFromKey(r.id)).filter((x): x is string => !!x) } },
    select: { id: true, runnerName: true, disabledAt: true },
  });
  const profileOf = new Map(users.filter((u) => !u.disabledAt).map((u) => [`u:${u.id}`, u.runnerName]));

  const build = (key: BoardKey): BoardView => {
    const evs = key === "season" ? events : events.filter((e) => e.month === (key === "month1" ? 1 : 2));
    const columns =
      key === "season"
        ? [
            { id: "m1", label: "M1" },
            { id: "m2", label: "M2" },
          ]
        : evs.map((e) => ({ id: e.id, label: `E${e.index}` }));
    return {
      key,
      title: TITLES[key],
      prize: prizes[key],
      columns,
      eventsDone: evs.filter((e) => e.status === "DONE").length,
      eventsTotal: evs.length,
      rows: boards[key].map((r) => ({
        key: r.id,
        name: nameOf(r.id),
        profile: profileOf.get(r.id) ?? null,
        rank: r.rank,
        total: r.total,
        titles: r.titles,
        cells:
          key === "season"
            ? [r.byMonth[1] || null, r.byMonth[2] || null]
            : evs.map((e) => r.byEvent[e.id]?.points ?? null),
      })),
    };
  };
  return { season, boards: { month1: build("month1"), month2: build("month2"), season: build("season") } };
}

export interface PastSeason {
  id: string;
  name: string;
  startDate: Date;
  archivedAt: Date | null;
  boards: Partial<Record<BoardKey, { prize: string; rows: (SnapshotRow & { profile: string | null })[] }>>;
}

/** Archived seasons with their frozen boards, newest first. */
export async function getPastSeasons(db: PrismaClient): Promise<PastSeason[]> {
  const seasons = await db.season.findMany({
    where: { status: "ARCHIVED" },
    include: { snapshots: true },
    orderBy: { archivedAt: "desc" },
  });
  const parsed = seasons.map((s) => ({
    s,
    boards: s.snapshots.map(
      (snap) => [snap.boardKey, snap.rowsJson as unknown as { prize: string; rows: SnapshotRow[] }] as const,
    ),
  }));
  // Link to profiles by the account's current runner name (it may have been renamed since).
  const ids = [
    ...new Set(
      parsed.flatMap((p) =>
        p.boards.flatMap(([, b]) => b.rows.map((r) => r.userId)).filter((x): x is string => !!x),
      ),
    ),
  ];
  const users = await db.user.findMany({
    where: { id: { in: ids }, disabledAt: null },
    select: { id: true, runnerName: true },
  });
  const current = new Map(users.map((u) => [u.id, u.runnerName]));
  return parsed.map(({ s, boards }) => ({
    id: s.id,
    name: s.name,
    startDate: s.startDate,
    archivedAt: s.archivedAt,
    boards: Object.fromEntries(
      boards.map(([key, b]) => [
        key,
        {
          prize: b.prize,
          rows: b.rows.map((r) => ({ ...r, profile: r.userId ? (current.get(r.userId) ?? null) : null })),
        },
      ]),
    ),
  }));
}
