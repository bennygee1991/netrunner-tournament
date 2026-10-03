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

export function ProfileForm({ theme, email, bio }: { theme: string; email: string; bio: string }) {
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
      <div className="mb-4 flex flex-col gap-1">
        <label htmlFor="f-bio" className="font-mono text-xs tracking-widest text-muted uppercase">
          Bio (public, optional)
        </label>
        <textarea
          id="f-bio"
          name="bio"
          rows={3}
          maxLength={280}
          defaultValue={state.values?.bio ?? bio}
          aria-invalid={fe.bio ? true : undefined}
          className="rounded border border-border bg-bg px-3 py-2 text-base text-fg focus:border-cyan"
          placeholder="Favourite faction, local meta, catchphrase…"
        />
        <p className="text-xs text-muted">Shown on your public profile. Up to 280 characters.</p>
        {fe.bio && <p className="text-sm text-danger">{fe.bio}</p>}
      </div>
      <SubmitButton pendingText="Saving…" variant="secondary">
        Save profile
      </SubmitButton>
    </form>
  );
}
