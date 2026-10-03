import { z } from "zod";
import {
  EngineError,
  type EventState,
  dropEntrant,
  finishEvent,
  pairNextRound,
  reopenEvent,
  resetEvent,
  restartRound,
  setResult,
  startCut,
  startSwiss,
  undoRound,
  undropEntrant,
  type Rng,
} from "@/engine";
import type { Prisma, PrismaClient } from "@/generated/prisma/client";
import { type Actor, audit } from "../audit";
import { ConflictError, ServiceError } from "./errors";
import { clearOutcome, recordOutcome } from "./records";
import { type LoadedEvent, loadEvent, saveEvent } from "./state";

export type OpResult = { ok: true; state: EventState } | { ok: false; error: string };

/**
 * Loads an event, applies an engine operation, saves it (version-checked), keeps the permanent
 * records in step with the finished/unfinished status, and writes an audit row. All in one transaction.
 */
export async function runEventOp(
  db: PrismaClient,
  actor: Actor,
  eventId: unknown,
  action: string,
  op: (loaded: LoadedEvent) => EventState,
  detail: (loaded: LoadedEvent, next: EventState) => Prisma.InputJsonObject = () => ({}),
  /** Version the admin's page was rendered with; a mismatch means the page is stale. */
  expectedVersion?: unknown,
): Promise<OpResult> {
  const id = z.string().min(1).max(64).safeParse(eventId);
  if (!id.success) return { ok: false, error: "Event not found." };
  try {
    const state = await db.$transaction(async (tx) => {
      const loaded = await loadEvent(tx, id.data);
      if (expectedVersion !== undefined && Number(expectedVersion) !== loaded.version)
        throw new ConflictError();
      const next = op(loaded);
      await saveEvent(tx, id.data, loaded.version, next);
      const wasDone = loaded.state.status === "done";
      const isDone = next.status === "done";
      if (isDone && !wasDone) await recordOutcome(tx, loaded, next);
      if (wasDone && !isDone) await clearOutcome(tx, id.data);
      await audit(tx, actor, action, {
        eventId: id.data,
        eventName: loaded.event.name,
        before: loaded.state.status,
        after: next.status,
        ...detail(loaded, next),
      });
      return next;
    });
    return { ok: true, state };
  } catch (err) {
    if (err instanceof EngineError || err instanceof ServiceError) return { ok: false, error: err.message };
    throw err;
  }
}

export function opStartSwiss(db: PrismaClient, actor: Actor, eventId: unknown, rng: Rng, version?: unknown) {
  return runEventOp(
    db,
    actor,
    eventId,
    "event.start_swiss",
    (l) => startSwiss(l.state, l.nameOf, rng),
    (_l, next) => ({ entrants: next.entrants.length, swissRounds: next.swissRounds, cutSize: next.cutSize }),
    version,
  );
}

export function opPairNext(db: PrismaClient, actor: Actor, eventId: unknown, rng: Rng, version?: unknown) {
  return runEventOp(
    db,
    actor,
    eventId,
    "event.pair_round",
    (l) => pairNextRound(l.state, l.nameOf, rng),
    (_l, next) => ({ round: next.rounds.length }),
    version,
  );
}

export function opStartCut(db: PrismaClient, actor: Actor, eventId: unknown, rng: Rng, version?: unknown) {
  return runEventOp(
    db,
    actor,
    eventId,
    "event.start_cut",
    (l) => startCut(l.state, l.nameOf, rng),
    (_l, next) => ({ cutSize: next.cutSize }),
    version,
  );
}

export function opFinish(db: PrismaClient, actor: Actor, eventId: unknown, version?: unknown) {
  return runEventOp(db, actor, eventId, "event.finish", (l) => finishEvent(l.state), undefined, version);
}

export const resultInput = z.object({
  phase: z.enum(["swiss", "cut"]),
  round: z.coerce.number().int().min(0).max(50),
  match: z.coerce.number().int().min(0).max(500),
  game: z.coerce.number().pipe(z.union([z.literal(1), z.literal(2)])),
  result: z.enum(["A", "B", "D", ""]).transform((v) => (v === "" ? null : v)),
  /** Players the admin saw at this table; guards against entering a result on a re-paired round. */
  a: z.string().max(64).optional(),
  b: z.string().max(64).optional(),
});

export function opSetResult(db: PrismaClient, actor: Actor, eventId: unknown, raw: unknown, rng: Rng) {
  const parsed = resultInput.safeParse(raw);
  if (!parsed.success) return Promise.resolve({ ok: false as const, error: "Invalid result." });
  const input = parsed.data;
  return runEventOp(
    db,
    actor,
    eventId,
    "event.result",
    (l) => {
      if (input.a !== undefined) {
        const rounds = input.phase === "swiss" ? l.state.rounds : l.state.cut;
        const m = rounds[input.round]?.matches[input.match];
        if (!m || m.a !== input.a || (m.b ?? "") !== (input.b ?? "")) throw new ConflictError();
      }
      return setResult(l.state, input, l.nameOf, rng);
    },
    (l) => {
      const rounds = input.phase === "swiss" ? l.state.rounds : l.state.cut;
      const m = rounds[input.round]?.matches[input.match];
      const previous = m ? (input.game === 1 ? m.g1 : m.g2) : null;
      return {
        phase: input.phase,
        round: input.round + 1,
        table: input.match + 1,
        game: input.game,
        players: m ? [l.nameOf(m.a), m.b ? l.nameOf(m.b) : "BYE"] : [],
        resultBefore: previous,
        resultAfter: input.result,
      };
    },
  );
}

// ------------------------------------------------------------------ repair tools (M5)

const phaseSchema = z.enum(["swiss", "cut"]);

/** Discard the current round's pairings and results and pair again (includes late adds, excludes drops). */
export function opRestartRound(
  db: PrismaClient,
  actor: Actor,
  eventId: unknown,
  phase: unknown,
  rng: Rng,
  version?: unknown,
) {
  const p = phaseSchema.safeParse(phase);
  if (!p.success) return Promise.resolve({ ok: false as const, error: "Invalid phase." });
  return runEventOp(
    db,
    actor,
    eventId,
    "event.restart_round",
    (l) => restartRound(l.state, p.data, l.nameOf, rng),
    (l) => ({ phase: p.data, round: p.data === "swiss" ? l.state.rounds.length : l.state.cut.length }),
    version,
  );
}

export function opUndoRound(
  db: PrismaClient,
  actor: Actor,
  eventId: unknown,
  phase: unknown,
  version?: unknown,
) {
  const p = phaseSchema.safeParse(phase);
  if (!p.success) return Promise.resolve({ ok: false as const, error: "Invalid phase." });
  return runEventOp(
    db,
    actor,
    eventId,
    "event.undo_round",
    (l) => undoRound(l.state, p.data),
    (l) => ({ phase: p.data, round: p.data === "swiss" ? l.state.rounds.length : l.state.cut.length }),
    version,
  );
}

export function opReopen(db: PrismaClient, actor: Actor, eventId: unknown, version?: unknown) {
  return runEventOp(db, actor, eventId, "event.reopen", (l) => reopenEvent(l.state), undefined, version);
}

/** Reset a single event back to sign-up (keeps entrants). Requires typing the event name. */
export function opResetEvent(db: PrismaClient, actor: Actor, eventId: unknown, confirmation: unknown) {
  return runEventOp(db, actor, eventId, "event.reset", (l) => {
    if (typeof confirmation !== "string" || confirmation.trim() !== l.event.name) {
      throw new ServiceError(`Type the event name "${l.event.name}" exactly to confirm.`);
    }
    return resetEvent(l.state);
  });
}

function entrantOp(
  db: PrismaClient,
  actor: Actor,
  eventId: unknown,
  entrantId: unknown,
  action: string,
  fn: (state: EventState, id: string) => EventState,
) {
  const eid = z.string().min(1).max(64).safeParse(entrantId);
  if (!eid.success) return Promise.resolve({ ok: false as const, error: "Entrant not found." });
  return runEventOp(
    db,
    actor,
    eventId,
    action,
    (l) => {
      if (l.state.status === "done") throw new ServiceError("This event is finished. Reopen it first.");
      if (!l.state.entrants.includes(eid.data)) throw new ServiceError("Entrant not found.");
      return fn(l.state, eid.data);
    },
    (l) => ({ player: l.nameOf(eid.data) }),
  );
}

/** Drop: excluded from future pairings and the cut, kept in standings. */
export function opDrop(db: PrismaClient, actor: Actor, eventId: unknown, entrantId: unknown) {
  return entrantOp(db, actor, eventId, entrantId, "event.drop", dropEntrant);
}

export function opUndrop(db: PrismaClient, actor: Actor, eventId: unknown, entrantId: unknown) {
  return entrantOp(db, actor, eventId, entrantId, "event.undrop", undropEntrant);
}
