"use client";

import { useSyncExternalStore } from "react";
import { ActionForm } from "@/components/action-form";
import { cx } from "@/components/ui";
import { type Clock, formatClock, remainingMs } from "@/lib/clock";
import type { FormState } from "@/lib/forms/state";

// A shared one-second tick. The snapshot is whole seconds, so it is stable between ticks; the
// server snapshot is null, so markup always hydrates and the time appears after mounting.
function subscribe(onTick: () => void) {
  const t = setInterval(onTick, 1000);
  return () => clearInterval(t);
}
const nowSecond = () => Math.floor(Date.now() / 1000);
const serverNow = () => null;

function useNow(): number | null {
  const s = useSyncExternalStore(subscribe, nowSecond, serverNow);
  return s === null ? null : s * 1000;
}

/** Live countdown for a round (or a deciding game). Everyone sees the same time from the server data. */
export function RoundClock({
  label,
  clock,
  limitMin,
  compact = false,
}: {
  label: string;
  clock: Clock | null;
  limitMin: number;
  compact?: boolean;
}) {
  const now = useNow();
  const left = now === null ? null : remainingMs(clock, limitMin, now);
  const over = left !== null && left <= 0;
  const text = !clock ? `${limitMin}:00` : left === null ? "--:--" : formatClock(left);
  const status = !clock ? "not started" : clock.pausedAt ? "paused" : over ? "time!" : "running";
  return (
    <div
      role="timer"
      aria-label={`${label}: ${text} ${status}`}
      className={cx(
        "flex items-baseline gap-2 rounded border font-mono",
        compact ? "px-2 py-0.5 text-xs" : "mb-3 px-3 py-2",
        over
          ? "border-danger text-danger"
          : clock?.pausedAt
            ? "border-warn text-warn"
            : "border-cyan text-cyan",
        !clock && "border-border text-muted",
      )}
    >
      {!compact && <span className="text-[11px] tracking-widest text-muted uppercase">{label}</span>}
      <span className={cx("font-bold tabular-nums", compact ? "" : "text-2xl")}>{text}</span>
      <span className="text-[11px] uppercase">{status}</span>
      {over && !compact && (
        <span className="text-xs">
          Time: finish per the Rules page (active player ends their turn, then one more).
        </span>
      )}
    </div>
  );
}

/** Organizer buttons for a clock: start, pause/resume, +1 minute, restart. */
export function ClockControls({
  action,
  eventId,
  target,
  match,
  clock,
  label,
}: {
  action: (s: FormState, f: FormData) => Promise<FormState>;
  eventId: string;
  target: "round" | "decider";
  match?: number;
  clock: Clock | null;
  label: string;
}) {
  const btn = (op: string, text: string, tone = "border-border hover:border-cyan") => (
    <button
      type="submit"
      name="op"
      value={op}
      className={cx("min-h-11 flex-1 rounded border px-2 font-mono text-sm uppercase", tone)}
    >
      {text}
    </button>
  );
  return (
    <ActionForm
      action={action}
      fields={{ eventId, target, ...(match !== undefined ? { match } : {}) }}
      showMessage={false}
    >
      <div className="flex gap-2" role="group" aria-label={`${label} controls`}>
        {!clock
          ? btn("start", "Start clock", "border-cyan text-cyan")
          : clock.pausedAt
            ? btn("resume", "Resume", "border-cyan text-cyan")
            : btn("pause", "Pause")}
        {clock && btn("add", "+1 min")}
        {clock && btn("reset", "Restart")}
      </div>
    </ActionForm>
  );
}
