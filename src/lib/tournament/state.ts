import type { EventState, GameResult, NameOf, Round } from "@/engine";
import type { Prisma, PrismaClient } from "@/generated/prisma/client";
import { ConflictError, ServiceError } from "./errors";

export type Db = PrismaClient | Prisma.TransactionClient;

export interface EntrantInfo {
  id: string;
  userId: string | null;
  guestName: string | null;
  name: string;
  dropped: boolean;
}

export interface LoadedEvent {
  state: EventState;
  version: number;
  entrants: EntrantInfo[];
  nameOf: NameOf;
  event: {
    id: string;
    name: string;
    date: Date;
    index: number;
    seasonId: string;
    seasonName: string;
  };
}

const STATUS_TO_ENGINE = { SIGNUP: "signup", SWISS: "swiss", CUT: "cut", DONE: "done" } as const;
const STATUS_TO_DB = { signup: "SIGNUP", swiss: "SWISS", cut: "CUT", done: "DONE" } as const;

export const eventInclude = {
  season: { select: { name: true } },
  entrants: { include: { user: { select: { runnerName: true } } }, orderBy: { createdAt: "asc" } },
  rounds: {
    orderBy: [{ phase: "asc" }, { number: "asc" }],
    include: { matches: { orderBy: { table: "asc" } } },
  },
} satisfies Prisma.EventInclude;

type EventRow = Prisma.EventGetPayload<{ include: typeof eventInclude }>;

export function entrantName(e: { guestName: string | null; user: { runnerName: string } | null }): string {
  return e.user?.runnerName ?? e.guestName ?? "Unknown";
}

/** Maps a DB event (with entrants, rounds, matches) to the engine's EventState. */
export function toLoaded(row: EventRow): LoadedEvent {
  const entrants: EntrantInfo[] = row.entrants.map((e) => ({
    id: e.id,
    userId: e.userId,
    guestName: e.guestName,
    name: entrantName(e),
    dropped: e.dropped,
  }));
  const names = new Map(entrants.map((e) => [e.id, e.name]));
  const toRound = (r: EventRow["rounds"][number]): Round => ({
    matches: r.matches.map((m) => ({
      a: m.aEntrantId,
      b: m.bEntrantId,
      corp: m.corpEntrantId === null ? null : m.corpEntrantId === m.aEntrantId ? "a" : "b",
      g1: m.result1 as GameResult | null,
      g2: m.result2 as GameResult | null,
    })),
  });
  const state: EventState = {
    id: row.id,
    month: row.month === 2 ? 2 : 1,
    format: row.matchFormat === "DOUBLE" ? "double" : "single",
    status: STATUS_TO_ENGINE[row.status],
    entrants: entrants.map((e) => e.id),
    dropped: entrants.filter((e) => e.dropped).map((e) => e.id),
    swissRounds: row.swissRounds,
    cutSize: row.cutSize,
    rounds: row.rounds.filter((r) => r.phase === "SWISS").map(toRound),
    cut: row.rounds.filter((r) => r.phase === "CUT").map(toRound),
  };
  return {
    state,
    version: row.version,
    entrants,
    nameOf: (id) => names.get(id) ?? "Unknown",
    event: {
      id: row.id,
      name: row.name,
      date: row.date,
      index: row.index,
      seasonId: row.seasonId,
      seasonName: row.season.name,
    },
  };
}

export async function loadEvent(db: Db, eventId: string): Promise<LoadedEvent> {
  const row = await db.event.findUnique({ where: { id: eventId }, include: eventInclude });
  if (!row) throw new ServiceError("Event not found.");
  return toLoaded(row);
}

/**
 * Writes the engine state back (status, rounds, matches, drops), guarded by the version number so
 * two admins editing at once cannot overwrite each other. Entrant rows must already exist.
 */
export async function saveEvent(
  tx: Prisma.TransactionClient,
  eventId: string,
  version: number,
  state: EventState,
) {
  const updated = await tx.event.updateMany({
    where: { id: eventId, version },
    data: {
      status: STATUS_TO_DB[state.status],
      swissRounds: state.swissRounds,
      cutSize: state.cutSize,
      version: { increment: 1 },
    },
  });
  if (updated.count !== 1) throw new ConflictError();

  const dropped = new Set(state.dropped);
  await tx.entrant.updateMany({ where: { eventId, id: { in: [...dropped] } }, data: { dropped: true } });
  await tx.entrant.updateMany({ where: { eventId, id: { notIn: [...dropped] } }, data: { dropped: false } });

  await tx.round.deleteMany({ where: { eventId } });
  const write = async (rounds: Round[], phase: "SWISS" | "CUT") => {
    for (const [i, r] of rounds.entries()) {
      await tx.round.create({
        data: {
          eventId,
          phase,
          number: i + 1,
          matches: {
            create: r.matches.map((m, table) => ({
              table: table + 1,
              aEntrantId: m.a,
              bEntrantId: m.b,
              corpEntrantId: m.corp === null || m.b === null ? null : m.corp === "a" ? m.a : m.b,
              result1: m.g1,
              result2: m.g2,
            })),
          },
        },
      });
    }
  };
  await write(state.rounds, "SWISS");
  await write(state.cut, "CUT");
}
