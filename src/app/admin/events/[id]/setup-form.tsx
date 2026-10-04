"use client";

import { useActionState } from "react";
import { SubmitButton } from "@/components/submit-button";
import { Field, FormMessage } from "@/components/ui";
import { setupAction } from "./actions";

const selectClass = "min-h-11 rounded border border-border bg-bg px-3 py-2 font-mono text-base text-fg";
const labelClass = "font-mono text-xs tracking-widest text-muted uppercase";

export function SetupForm({
  event,
  locked,
  autoRounds,
}: {
  event: {
    id: string;
    name: string;
    date: string;
    month: number;
    matchFormat: string;
    swissRounds: number | null;
    cutSize: number;
    startTime: string;
    venue: string;
    notes: string;
    finale: boolean;
  };
  locked: boolean;
  autoRounds: number;
}) {
  const [state, action] = useActionState(setupAction, {});
  const fe = state.fieldErrors ?? {};
  return (
    <form action={action} noValidate>
      <input type="hidden" name="eventId" value={event.id} />
      {state.error && <FormMessage tone="error">{state.error}</FormMessage>}
      {state.message && <FormMessage tone="ok">{state.message}</FormMessage>}
      <Field
        id="setup-name"
        label="Event name"
        name="name"
        defaultValue={event.name}
        error={fe.name}
        maxLength={60}
      />
      <Field id="setup-date" label="Date" name="date" type="date" defaultValue={event.date} error={fe.date} />
      <div className="mb-4 flex flex-col gap-1">
        <label htmlFor="setup-month" className={labelClass}>
          Leaderboard
        </label>
        <select id="setup-month" name="month" defaultValue={String(event.month)} className={selectClass}>
          <option value="1">Month 1</option>
          <option value="2">Month 2</option>
        </select>
      </div>
      {locked ? (
        <>
          <input type="hidden" name="matchFormat" value={event.matchFormat} />
          <input type="hidden" name="swissRounds" value={event.swissRounds ?? ""} />
          <input type="hidden" name="cutSize" value={event.cutSize} />
          <input type="hidden" name="finale" value={event.finale ? "on" : ""} />
          <p className="mb-4 text-sm text-muted">
            Format, Swiss rounds and cut size are locked once the event starts.
          </p>
        </>
      ) : (
        <>
          <div className="mb-4 flex flex-col gap-1">
            <label htmlFor="setup-format" className={labelClass}>
              Match format
            </label>
            <select
              id="setup-format"
              name="matchFormat"
              defaultValue={event.matchFormat}
              className={selectClass}
            >
              <option value="SINGLE">Single-sided · 1 game per round (~40-45 min)</option>
              <option value="DOUBLE">Double-sided · 2 games per round (~65-70 min)</option>
            </select>
          </div>
          <Field
            id="setup-rounds"
            label="Swiss rounds"
            name="swissRounds"
            type="number"
            inputMode="numeric"
            min={1}
            max={9}
            defaultValue={event.swissRounds ?? ""}
            placeholder={`Auto (${autoRounds} for the current entrants)`}
            error={fe.swissRounds}
            hint="Leave empty to use the recommended number for the player count when Swiss starts."
          />
          <div className="mb-4 flex flex-col gap-1">
            <label htmlFor="setup-cut" className={labelClass}>
              Top cut
            </label>
            <select
              id="setup-cut"
              name="cutSize"
              defaultValue={String(event.cutSize)}
              className={selectClass}
            >
              <option value="0">None (Swiss only)</option>
              <option value="4">Top 4</option>
              <option value="8">Top 8 (single elimination, house rule)</option>
            </select>
            {fe.cutSize && <p className="text-sm text-danger">{fe.cutSize}</p>}
          </div>
          <label className="mb-4 flex min-h-11 items-start gap-3">
            <input
              type="checkbox"
              name="finale"
              defaultChecked={event.finale}
              className="mt-1 size-5 accent-warn"
            />
            <span>
              Season finale
              <span className="block text-xs text-muted">
                Double league points, and the top cut is seeded from the Season leaderboard (usually 1 Swiss
                round, top 8).
              </span>
            </span>
          </label>
        </>
      )}
      <Field
        id="setup-time"
        label="Start time (optional)"
        name="startTime"
        type="time"
        defaultValue={event.startTime}
        error={fe.startTime}
      />
      <Field
        id="setup-venue"
        label="Venue (optional)"
        name="venue"
        defaultValue={event.venue}
        maxLength={120}
        error={fe.venue}
        placeholder="e.g. The Hive Game Store, 12 High St"
      />
      <div className="mb-4 flex flex-col gap-1">
        <label htmlFor="setup-notes" className={labelClass}>
          Notes for players (optional)
        </label>
        <textarea
          id="setup-notes"
          name="notes"
          rows={3}
          maxLength={1000}
          defaultValue={event.notes}
          aria-invalid={fe.notes ? true : undefined}
          className="rounded border border-border bg-bg px-3 py-2 text-base text-fg focus:border-cyan"
          placeholder="Entry fee, parking, what to bring…"
        />
        {fe.notes && <p className="text-sm text-danger">{fe.notes}</p>}
      </div>
      <SubmitButton variant="secondary" pendingText="Saving…">
        Save event
      </SubmitButton>
    </form>
  );
}
