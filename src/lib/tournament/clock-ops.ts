import { z } from "zod";
import { type EventState, ROUND_MINUTES, needsDecider } from "@/engine";
import type { PrismaClient } from "@/generated/prisma/client";
import { type Actor, audit } from "../audit";
import { type Clock, applyClockOp, readClocks } from "../clock";
import { loadEvent } from "./state";

/** The running round's key ("swiss:2", "cut:0"), or null when no round is being played. */
export function currentRoundKey(state: EventState): string | null {
  if (state.status === "swiss" && state.rounds.length) return `swiss:${state.rounds.length - 1}`;
  if (state.status === "cut" && state.cut.length) return `cut:${state.cut.length - 1}`;
  return null;
}

/** Minutes on the round clock: Swiss 45 single-sided / 65 double-sided; cut 65 per series match (45 single game). */
export function roundLimit(state: EventState): number {
  if (state.status === "cut")
    return state.cutFormat === "series" ? ROUND_MINUTES.cutMatch : ROUND_MINUTES.cutSingle;
  return state.format === "double" ? ROUND_MINUTES.double : ROUND_MINUTES.single;
}

export interface ClockView {
  label: string;
  limitMin: number;
  main: Clock | null;
  /** Series cut: game 3 clocks by match index. */
  deciders: Record<string, Clock>;
}

/** Clock data for the event pages, or null when no round is running. */
export function clockView(state: EventState, raw: unknown): ClockView | null {
  const key = currentRoundKey(state);
  if (!key) return null;
  const clocks = readClocks(raw, key);
  const label = state.status === "cut" ? "Cut round clock" : `Round ${state.rounds.length} clock`;
  return { label, limitMin: roundLimit(state), main: clocks.main, deciders: clocks.deciders };
}

const input = z.object({
  target: z.enum(["round", "decider"]),
  match: z.coerce.number().int().min(0).max(500).optional(),
  op: z.enum(["start", "pause", "resume", "add", "reset"]),
});

type Result = { ok: true; message?: string } | { ok: false; error: string };

/**
 * Organizer clock controls for the running round (and, in a series cut, each match's game 3).
 * Starting and restarting are audited; pause, resume and +1 minute are routine and are not.
 */
export async function opClock(
  db: PrismaClient,
  actor: Actor,
  eventId: unknown,
  raw: unknown,
  now = new Date(),
): Promise<Result> {
  const id = z.string().min(1).max(64).safeParse(eventId);
  const parsed = input.safeParse(raw);
  if (!id.success || !parsed.success) return { ok: false, error: "Invalid clock action." };
  const { target, match, op } = parsed.data;
  const loaded = await loadEvent(db, id.data);
  const key = currentRoundKey(loaded.state);
  if (!key) return { ok: false, error: "No round is being played." };
  if (target === "decider") {
    const m = match === undefined ? undefined : loaded.state.cut.at(-1)?.matches[match];
    if (loaded.state.status !== "cut" || loaded.state.cutFormat !== "series" || !m || !needsDecider(m)) {
      return { ok: false, error: "Game 3 is not being played in that match." };
    }
  }
  const row = await db.event.findUniqueOrThrow({ where: { id: id.data }, select: { clockJson: true } });
  const clocks = readClocks(row.clockJson, key);
  const current = target === "round" ? clocks.main : (clocks.deciders[String(match)] ?? null);
  const next = applyClockOp(current, op, now);
  if (next === undefined) return { ok: false, error: "That clock action doesn't apply right now." };
  if (target === "round") clocks.main = next;
  else if (next === null) delete clocks.deciders[String(match)];
  else clocks.deciders[String(match)] = next;

  await db.$transaction(async (tx) => {
    await tx.event.update({
      where: { id: id.data },
      data: { clockJson: JSON.parse(JSON.stringify(clocks)) },
    });
    if (op === "start" || op === "reset") {
      await audit(tx, actor, "event.clock", { eventId: id.data, round: key, target, match, op });
    }
  });
  return { ok: true };
}
