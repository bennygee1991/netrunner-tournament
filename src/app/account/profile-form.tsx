"use client";

import { useActionState } from "react";
import { SubmitButton } from "@/components/submit-button";
import { Field, FormMessage } from "@/components/ui";
import { initialFormState } from "@/lib/forms/state";
import { updateProfileAction } from "./actions";

const THEMES = [
  { value: "system", label: "Match my device" },
  { value: "dark", label: "Dark" },
  { value: "light", label: "Light" },
] as const;

export function ProfileForm({ theme, email }: { theme: string; email: string }) {
  const [state, action] = useActionState(updateProfileAction, initialFormState);
  const fe = state.fieldErrors ?? {};
  const currentTheme = state.values?.theme ?? theme;
  return (
    <form action={action} noValidate>
      {state.message && <FormMessage tone="ok">{state.message}</FormMessage>}
      <fieldset className="mb-4">
        <legend className="mb-2 font-mono text-xs tracking-widest text-muted uppercase">Theme</legend>
        <div className="flex flex-wrap gap-2">
          {THEMES.map((t) => (
            <label
              key={t.value}
              className="flex min-h-11 items-center gap-2 rounded border border-border px-3 has-[:checked]:border-cyan"
            >
              <input
                type="radio"
                name="theme"
                value={t.value}
                defaultChecked={currentTheme === t.value}
                className="accent-cyan"
              />
              {t.label}
            </label>
          ))}
        </div>
      </fieldset>
      <Field
        label="Email (optional)"
        name="email"
        type="email"
        autoComplete="email"
        defaultValue={state.values?.email ?? email}
        error={fe.email}
        hint="Only visible to the organizer."
      />
      <SubmitButton pendingText="Saving…" variant="secondary">
        Save preferences
      </SubmitButton>
    </form>
  );
}
