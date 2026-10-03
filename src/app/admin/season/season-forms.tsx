"use client";

import { useActionState } from "react";
import { SubmitButton } from "@/components/submit-button";
import { Field, FormMessage } from "@/components/ui";
import type { Prizes } from "@/lib/tournament/season";
import { createSeasonAction, updatePrizesAction } from "./actions";

export function CreateSeasonForm({ defaultName, defaultDate }: { defaultName: string; defaultDate: string }) {
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
