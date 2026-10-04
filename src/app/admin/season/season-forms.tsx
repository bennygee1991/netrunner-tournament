"use client";

import { useActionState } from "react";
import { SubmitButton } from "@/components/submit-button";
import { Field, FormMessage } from "@/components/ui";
import { type EventFormat, EventFormatFields } from "@/components/tournament/event-format-fields";
import type { Prizes } from "@/lib/tournament/season";

/** Field errors for one event of the season form ("e2.swissRounds" -> "swissRounds"). */
function eventErrors(fe: Partial<Record<string, string>>, n: number) {
  const out: Partial<Record<string, string>> = {};
  for (const [k, v] of Object.entries(fe)) if (k.startsWith(`e${n}.`)) out[k.slice(3)] = v;
  return out;
}
import { createSeasonAction, updatePrizesAction } from "./actions";

const EVENT_NAMES = ["Event 1", "Event 2", "Event 3", "Season finale (double points)"];

export function CreateSeasonForm({
  defaultName,
  defaultDate,
  formats,
}: {
  defaultName: string;
  defaultDate: string;
  /** League defaults per event, shown pre-ticked. */
  formats: EventFormat[];
}) {
  const [state, action] = useActionState(createSeasonAction, {});
  const fe = state.fieldErrors ?? {};
  return (
    <form action={action} noValidate>
      {state.error && <FormMessage tone="error">{state.error}</FormMessage>}
      <Field
        label="Season name"
        name="name"
        defaultValue={state.values?.name ?? defaultName}
        error={fe.name}
        required
      />
      <Field
        label="First event date"
        name="firstDate"
        type="date"
        defaultValue={state.values?.firstDate ?? defaultDate}
        error={fe.firstDate}
        required
        hint="Creates 4 events, one every 2 weeks. Events 1-2 feed the Month 1 board, events 3-4 Month 2."
      />
      <p className="mb-2 font-mono text-xs tracking-widest text-muted uppercase">Event formats</p>
      <p className="mb-2 text-sm text-muted">
        Pre-set to the league format (events 1-3 Swiss only, the finale with a top 4 cut). Open an event to
        change it; you can also change it later in the event&apos;s setup.
      </p>
      {formats.map((f, i) => (
        <details key={i} className="mb-2 rounded border border-border px-3 py-2">
          <summary className="cursor-pointer font-semibold">{EVENT_NAMES[i]}</summary>
          <div className="mt-3">
            <EventFormatFields prefix={`e${i + 1}.`} initial={f} errors={eventErrors(fe, i + 1)} />
          </div>
        </details>
      ))}
      <SubmitButton pendingText="Creating…">Create season</SubmitButton>
    </form>
  );
}

export function PrizesForm({ seasonId, prizes }: { seasonId: string; prizes: Prizes }) {
  const [state, action] = useActionState(updatePrizesAction, {});
  return (
    <form action={action}>
      <input type="hidden" name="seasonId" value={seasonId} />
      {state.error && <FormMessage tone="error">{state.error}</FormMessage>}
      {state.message && <FormMessage tone="ok">{state.message}</FormMessage>}
      <Field
        label="Month 1 prize"
        name="month1"
        defaultValue={prizes.month1}
        placeholder="e.g. Promo playset"
        maxLength={200}
      />
      <Field label="Month 2 prize" name="month2" defaultValue={prizes.month2} maxLength={200} />
      <Field
        label="Season prize"
        name="season"
        defaultValue={prizes.season}
        placeholder="e.g. Trophy + title"
        maxLength={200}
      />
      <SubmitButton variant="secondary" pendingText="Saving…">
        Save prizes
      </SubmitButton>
    </form>
  );
}
