import { z } from "zod";
import { type EventState, type GameResult, type Rng, needsDecider, setResult } from "@/engine";
import type { Prisma, PrismaClient } from "@/generated/prisma/client";
import type { Actor } from "../audit";
import { runEventOp } from "./ops";
import { type LoadedEvent, loadEvent } from "./state";

/**
 * Player-reported results. A player in an open match of the current round reports each game
 * ("I won", "tie", "I lost"); nothing counts until the organizer approves it.
 */

type Tx = PrismaClient | Prisma.TransactionClient;

export interface ReportView {
  game: 1 | 2 | 3;
  reporterId: string;
  reporterName: string;
  result: GameResult;
}

export interface MatchReports {
  /** Reports per game, keyed "phase:round:match". */
  reports: ReportView[];
  /** Per game: the agreed result if every report agrees, or "conflict". */
  status: Partial<Record<1 | 2 | 3, GameResult | "conflict">>;
}

export const matchKey = (phase: "swiss" | "cut", round: number, match: number) =>
  `${phase}:${round}:${match}`;

const PHASE_DB = { swiss: "SWISS", cut: "CUT" } as const;
const PHASE_ENGINE = { SWISS: "swiss", CUT: "cut" } as const;

/** Open matches of the current round(s): the latest Swiss round while Swiss runs, the latest cut round in the cut. */
function openMatches(state: EventState) {
  const out: {
    phase: "swiss" | "cut";
    round: number;
    match: number;
    a: string;
    b: string;
    games: (1 | 2 | 3)[];
  }[] = [];
  const add = (phase: "swiss" | "cut") => {
    const rounds = phase === "swiss" ? state.rounds : state.cut;
    const ri = rounds.length - 1;
    rounds[ri]?.matches.forEach((m, mi) => {
      if (m.b === null) return;
      const games: (1 | 2 | 3)[] = [];
      if (phase === "cut" && state.cutFormat === "series") {
        // Sides first (the higher seed picks), then games 1-2, then game 3 if the match is level.
        if (m.corp === null) return;
        if (m.g1 === null) games.push(1);
        if (m.g2 === null) games.push(2);
        if (needsDecider(m) && m.g3 == null) games.push(3);
      } else {
        if (m.g1 === null) games.push(1);
        if (phase === "swiss" && state.format === "double" && m.g2 === null) games.push(2);
      }
      if (games.length) out.push({ phase, round: ri, match: mi, a: m.a, b: m.b, games });
    });
  };
  if (state.status === "swiss") add("swiss");
  if (state.status === "cut") add("cut");
  return out;
}

/** Removes reports that no longer match an open game (result entered, round re-paired or undone). */
export async function pruneReports(tx: Tx, eventId: string, state: EventState) {
  const open = openMatches(state);
  const live = new Set(
    open.flatMap((m) => m.games.map((g) => `${matchKey(m.phase, m.round, m.match)}:${g}:${m.a}:${m.b}`)),
  );
  const reports = await tx.resultReport.findMany({ where: { eventId } });
  const stale = reports
    .filter(
      (r) =>
        !live.has(
          `${matchKey(PHASE_ENGINE[r.phase], r.round, r.match)}:${r.game}:${r.aEntrantId}:${r.bEntrantId}`,
        ),
    )
    .map((r) => r.id);
  if (stale.length) await tx.resultReport.deleteMany({ where: { id: { in: stale } } });
}

/** Pending reports grouped per match, with agreement status per game. */
export async function pendingReports(db: Tx, loaded: LoadedEvent): Promise<Map<string, MatchReports>> {
  const reports = await db.resultReport.findMany({
    where: { eventId: loaded.event.id },
    include: { reporter: { select: { runnerName: true } } },
    orderBy: { createdAt: "asc" },
  });
  const open = new Map(openMatches(loaded.state).map((m) => [matchKey(m.phase, m.round, m.match), m]));
  const out = new Map<string, MatchReports>();
  for (const r of reports) {
    const key = matchKey(PHASE_ENGINE[r.phase], r.round, r.match);
    const m = open.get(key);
    if (!m || m.a !== r.aEntrantId || m.b !== r.bEntrantId || !m.games.includes(r.game as 1 | 2 | 3))
      continue;
    const entry = out.get(key) ?? { reports: [], status: {} };
    entry.reports.push({
      game: r.game as 1 | 2 | 3,
      reporterId: r.reporterId,
      reporterName: r.reporter.runnerName,
      result: r.result,
    });
    out.set(key, entry);
  }
  for (const entry of out.values()) {
    for (const g of [1, 2, 3] as const) {
      const results = new Set(entry.reports.filter((r) => r.game === g).map((r) => r.result));
      if (results.size === 1) entry.status[g] = [...results][0]!;
      else if (results.size > 1) entry.status[g] = "conflict";
    }
  }
  return out;
}

const reportInput = z.object({
  phase: z.enum(["swiss", "cut"]),
  round: z.coerce.number().int().min(0).max(50),
  match: z.coerce.number().int().min(0).max(500),
  game: z.coerce.number().pipe(z.union([z.literal(1), z.literal(2), z.literal(3)])),
  /** From the reporter's point of view. */
  outcome: z.enum(["win", "tie", "loss"]),
});

type Result = { ok: true; message: string } | { ok: false; error: string };

/** A player reports one game of their own open match. Re-reporting replaces their earlier report. */
export async function playerReport(
  db: PrismaClient,
  userId: string,
  eventId: unknown,
  raw: unknown,
): Promise<Result> {
  const id = z.string().min(1).max(64).safeParse(eventId);
  const parsed = reportInput.safeParse(raw);
  if (!id.success || !parsed.success) return { ok: false, error: "Invalid report." };
  const { phase, round, match, game, outcome } = parsed.data;
  const loaded = await loadEvent(db, id.data);
  const open = openMatches(loaded.state).find(
    (m) => m.phase === phase && m.round === round && m.match === match,
  );
  if (!open || !open.games.includes(game)) {
    return {
      ok: false,
      error:
        "This game is not open for reporting (the round may have changed or the result is already confirmed).",
    };
  }
  const me = loaded.entrants.find((e) => e.userId === userId && (e.id === open.a || e.id === open.b));
  if (!me) return { ok: false, error: "You can only report your own matches." };
  if (outcome === "tie" && phase === "cut")
    return { ok: false, error: "Cut games are reported as a win or a loss." };
  const iAmA = me.id === open.a;
  const result: GameResult = outcome === "tie" ? "D" : (outcome === "win") === iAmA ? "A" : "B";

  await db.resultReport.upsert({
    where: {
      eventId_phase_round_match_game_reporterId: {
        eventId: id.data,
        phase: PHASE_DB[phase],
        round,
        match,
        game,
        reporterId: userId,
      },
    },
    create: {
      eventId: id.data,
      phase: PHASE_DB[phase],
      round,
      match,
      game,
      aEntrantId: open.a,
      bEntrantId: open.b,
      result,
      reporterId: userId,
    },
    update: { result, aEntrantId: open.a, bEntrantId: open.b },
  });
  return { ok: true, message: "Result reported. It counts once the organizer approves it." };
}

/** Approves every game whose reports all agree, in one change. Conflicts are left for the organizer. */
export async function opApproveAgreedReports(
  db: PrismaClient,
  actor: Actor,
  eventId: unknown,
  rng: Rng,
  version?: unknown,
) {
  const id = z.string().min(1).max(64).safeParse(eventId);
  if (!id.success) return { ok: false as const, error: "Event not found." };
  const pending = await pendingReports(db, await loadEvent(db, id.data));
  const toApply: {
    phase: "swiss" | "cut";
    round: number;
    match: number;
    game: 1 | 2 | 3;
    result: GameResult;
  }[] = [];
  // Approved reports per player (for the Reporter badge).
  const approvedBy = new Map<string, number>();
  for (const [key, entry] of pending) {
    const [phase, round, match] = key.split(":") as ["swiss" | "cut", string, string];
    for (const g of [1, 2, 3] as const) {
      const st = entry.status[g];
      if (st && st !== "conflict") {
        toApply.push({ phase, round: Number(round), match: Number(match), game: g, result: st });
        for (const r of entry.reports.filter((x) => x.game === g))
          approvedBy.set(r.reporterId, (approvedBy.get(r.reporterId) ?? 0) + 1);
      }
    }
  }
  if (!toApply.length) return { ok: false as const, error: "No agreed reports to approve." };
  const res = await runEventOp(
    db,
    actor,
    id.data,
    "event.approve_reports",
    (l) => {
      let state = l.state;
      // Cut games last so a completed cut round auto-advances after its own results.
      for (const r of [...toApply].sort((x, y) => (x.phase === y.phase ? 0 : x.phase === "swiss" ? -1 : 1))) {
        state = setResult(
          state,
          { phase: r.phase, round: r.round, match: r.match, game: r.game, result: r.result },
          l.nameOf,
          rng,
        );
      }
      return state;
    },
    (l) => ({
      approved: toApply.map((r) => {
        const m = (r.phase === "swiss" ? l.state.rounds : l.state.cut)[r.round]?.matches[r.match];
        return `${r.phase} R${r.round + 1} T${r.match + 1} G${r.game}: ${m ? `${l.nameOf(m.a)} vs ${m.b ? l.nameOf(m.b) : "BYE"}` : "?"} = ${r.result}`;
      }),
    }),
    version,
  );
  if (res.ok) {
    for (const [userId, n] of approvedBy)
      await db.user.updateMany({ where: { id: userId }, data: { reportsApproved: { increment: n } } });
  }
  return res;
}
