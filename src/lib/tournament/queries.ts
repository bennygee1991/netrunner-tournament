import {
  type EventResult,
  type Standing,
  cutHigherSeed,
  cutRoundLabel,
  cutSeeds,
  cutWinner,
  needsDecider,
  roundComplete,
  defaultSwissRounds,
  eventResults,
  nextStep,
  standings,
} from "@/engine";
import type { PrismaClient } from "@/generated/prisma/client";
import type { Clock } from "../clock";
import { type ClockView, clockView } from "./clock-ops";
import { todayIso, toIsoDate } from "./dates";
import { type MatchReports, matchKey, pendingReports } from "./reports";
import { readPrizes } from "./season";
import { type LoadedEvent, ONE_OFF_LABEL, eventInclude, toLoaded } from "./state";

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
  /**
   * Series cut matches only: game 3, its Corp, who picks sides (higher seed), whether game 3 is
   * needed, and the match winner once known. Null for every other match.
   */
  series: {
    g3: "A" | "B" | "D" | null;
    corp3Id: string | null;
    pickerId: string;
    decider: boolean;
    winnerId: string | null;
    /** Game 3 clock (started by the organizer when the decider begins). */
    deciderClock: Clock | null;
  } | null;
  /** Player reports waiting for the organizer (open games only). */
  reports: MatchReports | null;
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
    seasonId: string | null;
    seasonName: string;
    seasonActive: boolean;
    oneOff: boolean;
    startTime: string | null;
    venue: string | null;
    notes: string | null;
    finale: boolean;
    cutFormat: "SINGLE" | "SERIES";
  };
  nextStep: ReturnType<typeof nextStep>;
  standings: Standing[];
  /** Every player's Swiss points after each round (for the flowchart). */
  pointsAfter: Record<string, number>[];
  results: Map<string, EventResult> | null;
  swiss: RoundView[];
  cut: RoundView[];
  seeds: Map<string, number>;
  entrants: LoadedEvent["entrants"];
  /** Sign-ups not yet approved. */
  pending: { userId: string; runnerName: string; at: Date }[];
  /** The running round's clock (null when no round is being played). */
  clock: ClockView | null;
  /** Number of games whose player reports agree and can be approved in one go. */
  agreedReports: number;
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
  const reports = await pendingReports(db, loaded);
  const series = state.cutFormat === "series";
  const clock = clockView(state, row.clockJson);
  const seedMap = state.cut.length ? cutSeeds(state, nameOf) : new Map<string, number>();
  const roundViews = (rounds: typeof state.rounds, phase: "swiss" | "cut"): RoundView[] =>
    rounds.map((r, i) => ({
      index: i,
      label: phase === "swiss" ? `Round ${i + 1}` : cutRoundLabel(r.matches.length),
      complete: roundComplete(state, r, phase),
      matches: r.matches.map((m, j) => ({
        index: j,
        a: player(m.a),
        b: m.b ? player(m.b) : null,
        corpId: m.corp === null || m.b === null ? null : m.corp === "a" ? m.a : m.b,
        g1: m.g1,
        g2: m.g2,
        series:
          phase === "cut" && series && m.b
            ? {
                g3: m.g3 ?? null,
                corp3Id: m.corp3 == null ? null : m.corp3 === "a" ? m.a : m.b,
                pickerId: cutHigherSeed(m, seedMap),
                decider: needsDecider(m),
                winnerId: cutWinner(m, seedMap, "series"),
                deciderClock: i === state.cut.length - 1 ? (clock?.deciders[String(j)] ?? null) : null,
              }
            : null,
        reports: reports.get(matchKey(phase, i, j)) ?? null,
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
      seasonName: row.season?.name ?? ONE_OFF_LABEL,
      // One-off events take sign-ups on their own (no season to be running).
      seasonActive: row.season ? row.season.status === "ACTIVE" : true,
      oneOff: row.seasonId === null,
      startTime: row.startTime,
      venue: row.venue,
      notes: row.notes,
      finale: row.finale,
      cutFormat: row.cutFormat,
    },
    nextStep: nextStep(state),
    standings: state.status === "signup" ? [] : standings(state, nameOf),
    pointsAfter: state.rounds.map((_, i) =>
      Object.fromEntries(
        standings({ ...state, rounds: state.rounds.slice(0, i + 1) }, nameOf).map((s) => [s.id, s.points]),
      ),
    ),
    results: state.status === "done" ? eventResults(state, nameOf) : null,
    swiss: roundViews(state.rounds, "swiss"),
    cut: roundViews(state.cut, "cut"),
    seeds: state.cut.length ? cutSeeds(state, nameOf) : new Map(),
    entrants: loaded.entrants,
    clock,
    agreedReports: [...reports.values()].reduce(
      (t, r) => t + Object.values(r.status).filter((s) => s && s !== "conflict").length,
      0,
    ),
    pending: signups
      .filter((s) => !entrantUserIds.has(s.userId) && !s.user.disabledAt)
      .map((s) => ({ userId: s.userId, runnerName: s.user.runnerName, at: s.createdAt })),
  };
}
