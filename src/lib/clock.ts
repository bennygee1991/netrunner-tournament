import { z } from "zod";

/**
 * Round clocks (league house rule: see ROUND_MINUTES). A clock is started by the organizer once
 * players are seated, and can be paused, given extra minutes or restarted. Times are absolute
 * (ISO strings), so every phone shows the same countdown from the same server data.
 */
export interface Clock {
  /** When the clock (re)started counting, shifted forward by any time spent paused. */
  startedAt: string;
  /** Set while paused. */
  pausedAt: string | null;
  /** Extra seconds the organizer added. */
  addedSec: number;
}

/** The clocks of one round: the round clock and, in a series cut, a clock per deciding game 3. */
export interface RoundClocks {
  /** Which round these clocks belong to, e.g. "swiss:2" or "cut:0"; stale once the round changes. */
  round: string;
  main: Clock | null;
  deciders: Record<string, Clock>;
}

const clockSchema = z.object({
  startedAt: z.string(),
  pausedAt: z.string().nullable(),
  addedSec: z.number().int(),
});
const roundClocksSchema = z.object({
  round: z.string(),
  main: clockSchema.nullable(),
  deciders: z.record(z.string(), clockSchema),
});

/** Reads the stored clocks, or empty clocks for `round` when nothing (or another round) is stored. */
export function readClocks(raw: unknown, round: string): RoundClocks {
  const parsed = roundClocksSchema.safeParse(raw);
  return parsed.success && parsed.data.round === round ? parsed.data : { round, main: null, deciders: {} };
}

export type ClockOp = "start" | "pause" | "resume" | "add" | "reset";

/** Applies an organizer action: the new clock, null when reset, or undefined when it does not apply (e.g. pausing a stopped clock). */
export function applyClockOp(clock: Clock | null, op: ClockOp, now: Date): Clock | null | undefined {
  const iso = now.toISOString();
  switch (op) {
    case "start":
      return clock ? undefined : { startedAt: iso, pausedAt: null, addedSec: 0 };
    case "pause":
      return clock && !clock.pausedAt ? { ...clock, pausedAt: iso } : undefined;
    case "resume": {
      if (!clock?.pausedAt) return undefined;
      const paused = now.getTime() - Date.parse(clock.pausedAt);
      return {
        ...clock,
        startedAt: new Date(Date.parse(clock.startedAt) + paused).toISOString(),
        pausedAt: null,
      };
    }
    case "add":
      return clock ? { ...clock, addedSec: clock.addedSec + 60 } : undefined;
    case "reset":
      return clock ? null : undefined;
  }
}

/** Milliseconds left (negative once time is up), or null if the clock has not started. */
export function remainingMs(clock: Clock | null, limitMinutes: number, now: number): number | null {
  if (!clock) return null;
  const at = clock.pausedAt ? Date.parse(clock.pausedAt) : now;
  return (limitMinutes * 60 + clock.addedSec) * 1000 - (at - Date.parse(clock.startedAt));
}

/** "41:07", or "-2:15" once over time. */
export function formatClock(ms: number): string {
  const sign = ms < 0 ? "-" : "";
  const total = Math.floor(Math.abs(ms) / 1000);
  return `${sign}${Math.floor(total / 60)}:${String(total % 60).padStart(2, "0")}`;
}
