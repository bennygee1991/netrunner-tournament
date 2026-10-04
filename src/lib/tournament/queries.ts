import {
  type EventResult,
  type Standing,
  cutRoundLabel,
  cutSeeds,
  defaultSwissRounds,
  eventResults,
  nextStep,
  standings,
} from "@/engine";
import type { PrismaClient } from "@/generated/prisma/client";
import { todayIso, toIsoDate } from "./dates";
import { type SeedingRow, seasonStandingsByPlayer, seedingTable } from "./finale";
import { readPrizes } from "./season";
import { type LoadedEvent, eventInclude, toLoaded } from "./state";

export async function getActiveSeason(db: PrismaClient) {
  const season = await db.season.findFirst({
    where: { status: "ACTIVE" },
    include: {
      events: {
        orderBy: { index: "asc" },
        include: { _count: { select: { entrants: true, signups: true } } },
      },
    },
  });
  return season ? { ...season, prizes: readPrizes(season.prizesJson) } : null;
}

type SeasonEvent = NonNullable<Awaited<ReturnType<typeof getActiveSeason>>>["events"][number];

/** Next event: first unfinished event dated today or later, else the first unfinished one. */
export function pickNextEvent<T extends Pick<SeasonEvent, "status" | "date">>(events: T[]): T | null {
  const open = events.filter((e) => e.status !== "DONE");
  const today = todayIso();
  return open.find((e) => toIsoDate(e.date) >= today) ?? open[0] ?? null;
}

/** Everything the home page needs: season, next event, open events with sign-ups, my sign-ups. */
export async function getHomeData(db: PrismaClient, userId: string | null) {
  const season = await getActiveSeason(db);
  if (!season) return null;
  const openIds = season.events.filter((e) => e.status === "SIGNUP").map((e) => e.id);
  const signups = await db.signup.findMany({
    where: { eventId: { in: openIds } },
    include: { user: { select: { runnerName: true } } },
    orderBy: { createdAt: "asc" },
  });
  return {
    season,
    next: pickNextEvent(season.events),
    open: season.events
      .filter((e) => e.status === "SIGNUP")
      .map((e) => ({
        ...e,
        signups: signups.filter((s) => s.eventId === e.id).map((s) => s.user.runnerName),
        mine: userId ? signups.some((s) => s.eventId === e.id && s.userId === userId) : false,
      })),
  };
}

export interface MatchView {
  index: number;
  a: { id: string; name: string };
  b: { id: string; name: string } | null;
  /** Corp in game 1 (entrant id). */
  corpId: string | null;
  g1: "A" | "B" | "D" | null;
  g2: "A" | "B" | "D" | null;
}

export interface RoundView {
  index: number;
  label: string;
  complete: boolean;
  matches: MatchView[];
}

export interface EventView {
  loaded: LoadedEvent;
  meta: {
    id: string;
    name: string;
    date: Date;
    month: number;
    status: "SIGNUP" | "SWISS" | "CUT" | "DONE";
    matchFormat: "SINGLE" | "DOUBLE";
    swissRounds: number | null;
    effectiveSwissRounds: number;
    cutSize: number;
    version: number;
    seasonId: string;
    seasonName: string;
    seasonActive: boolean;
    startTime: string | null;
    venue: string | null;
    notes: string | null;
    finale: boolean;
  };
  nextStep: ReturnType<typeof nextStep>;
  standings: Standing[];
  results: Map<string, EventResult> | null;
  swiss: RoundView[];
  cut: RoundView[];
  seeds: Map<string, number>;
  entrants: LoadedEvent["entrants"];
  /** Sign-ups not yet approved. */
  pending: { userId: string; runnerName: string; at: Date }[];
  /** Season finale: cut qualification by season standings (projected until the cut starts). */
  seasonSeeding: SeedingRow[] | null;
}

export async function getEventView(db: PrismaClient, eventId: string): Promise<EventView | null> {
  if (eventId.length > 64) return null;
  const row = await db.event.findUnique({
    where: { id: eventId },
    include: { ...eventInclude, season: { select: { name: true, status: true } } },
  });
  if (!row) return null;
  const loaded = toLoaded(row);
  const { state, nameOf } = loaded;
  const player = (id: string) => ({ id, name: nameOf(id) });
  const roundViews = (rounds: typeof state.rounds, phase: "swiss" | "cut"): RoundView[] =>
    rounds.map((r, i) => ({
      index: i,
      label: phase === "swiss" ? `Round ${i + 1}` : cutRoundLabel(r.matches.length),
      complete: r.matches.every(
        (m) => m.b === null || (phase === "swiss" && state.format === "double" ? m.g1 && m.g2 : m.g1),
      ),
      matches: r.matches.map((m, j) => ({
        index: j,
        a: player(m.a),
        b: m.b ? player(m.b) : null,
        corpId: m.corp === null || m.b === null ? null : m.corp === "a" ? m.a : m.b,
        g1: m.g1,
        g2: m.g2,
      })),
    }));

  const entrantUserIds = new Set(loaded.entrants.map((e) => e.userId).filter(Boolean));
  const signups = await db.signup.findMany({
    where: { eventId },
    include: { user: { select: { runnerName: true, disabledAt: true } } },
    orderBy: { createdAt: "asc" },
  });

  return {
    loaded,
    meta: {
      id: row.id,
      name: row.name,
      date: row.date,
      month: row.month,
      status: row.status,
      matchFormat: row.matchFormat,
      swissRounds: row.swissRounds,
      effectiveSwissRounds:
        row.swissRounds ?? defaultSwissRounds(state.format, Math.max(state.entrants.length, 2)),
      cutSize: row.cutSize,
      version: row.version,
      seasonId: row.seasonId,
      seasonName: row.season.name,
      seasonActive: row.season.status === "ACTIVE",
      startTime: row.startTime,
      venue: row.venue,
      notes: row.notes,
      finale: row.finale,
    },
    nextStep: nextStep(state),
    standings: state.status === "signup" ? [] : standings(state, nameOf),
    results: state.status === "done" ? eventResults(state, nameOf) : null,
    swiss: roundViews(state.rounds, "swiss"),
    cut: roundViews(state.cut, "cut"),
    seeds: state.cut.length ? cutSeeds(state, nameOf) : new Map(),
    entrants: loaded.entrants,
    seasonSeeding:
      row.finale && state.status !== "signup"
        ? seedingTable(state, nameOf, loaded.entrants, await seasonStandingsByPlayer(db, row.seasonId))
        : null,
    pending: signups
      .filter((s) => !entrantUserIds.has(s.userId) && !s.user.disabledAt)
      .map((s) => ({ userId: s.userId, runnerName: s.user.runnerName, at: s.createdAt })),
  };
}
