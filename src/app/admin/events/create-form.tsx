"use client";

import { useActionState } from "react";
import { SubmitButton } from "@/components/submit-button";
import { EventFormatFields } from "@/components/tournament/event-format-fields";
import { Field, FormMessage } from "@/components/ui";
import { initialFormState } from "@/lib/forms/state";
import { createOneOffAction } from "./actions";

/** New one-off event: details plus the same format toggles as season events. */
export function CreateOneOffForm({ defaultDate }: { defaultDate: string }) {
  const [state, action] = useActionState(createOneOffAction, initialFormState);
  const fe = state.fieldErrors ?? {};
  return (
    <form action={action} noValidate>
      {state.error && <FormMessage tone="error">{state.error}</FormMessage>}
      <Field
        id="oneoff-name"
        label="Event name"
        name="name"
        maxLength={60}
        error={fe.name}
        placeholder="Store championship"
      />
      <Field
        id="oneoff-date"
        label="Date"
        name="date"
        type="date"
        defaultValue={defaultDate}
        error={fe.date}
      />
      <Field
        id="oneoff-time"
        label="Start time (optional)"
        name="startTime"
        type="time"
        error={fe.startTime}
      />
      <Field id="oneoff-venue" label="Venue (optional)" name="venue" maxLength={120} error={fe.venue} />
      <Field
        id="oneoff-notes"
        label="Notes for players (optional)"
        name="notes"
        maxLength={1000}
        error={fe.notes}
      />
      <EventFormatFields
        prefix=""
        initial={{ matchFormat: "SINGLE", swissRounds: null, cutSize: 0, cutFormat: "SERIES" }}
        errors={fe}
      />
      <SubmitButton pendingText="Creating…">Create one-off event</SubmitButton>
    </form>
  );
}
