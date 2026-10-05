"use client";

import { useActionState } from "react";
import { SubmitButton } from "@/components/submit-button";
import { Field, FormMessage } from "@/components/ui";
import { EventFormatFields } from "@/components/tournament/event-format-fields";
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
    cutFormat: string;
    oneOff: boolean;
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
      {event.oneOff ? (
        // One-off events are not on any leaderboard.
        <input type="hidden" name="month" value="1" />
      ) : (
        <div className="mb-4 flex flex-col gap-1">
          <label htmlFor="setup-month" className={labelClass}>
            Leaderboard
          </label>
          <select id="setup-month" name="month" defaultValue={String(event.month)} className={selectClass}>
            <option value="1">Month 1</option>
            <option value="2">Month 2</option>
          </select>
        </div>
      )}
      {locked ? (
        <>
          <input type="hidden" name="matchFormat" value={event.matchFormat} />
          <input type="hidden" name="swissRounds" value={event.swissRounds ?? ""} />
          <input type="hidden" name="cutSize" value={event.cutSize} />
          <input type="hidden" name="finale" value={event.finale ? "on" : ""} />
          <input type="hidden" name="cutFormat" value={event.cutFormat} />
          <p className="mb-4 text-sm text-muted">
            Format, Swiss rounds and cut size are locked once the event starts.
          </p>
        </>
      ) : (
        <>
          <EventFormatFields
            initial={{
              matchFormat: event.matchFormat,
              swissRounds: event.swissRounds,
              cutSize: event.cutSize,
              cutFormat: event.cutFormat,
            }}
            errors={fe}
            autoRounds={autoRounds}
          />
          {!event.oneOff && (
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
                  Double league points (usually the last event: Swiss, then a top 4 cut).
                </span>
              </span>
            </label>
          )}
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
