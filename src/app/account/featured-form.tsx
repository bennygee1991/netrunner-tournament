"use client";

import { useActionState } from "react";
import { SubmitButton } from "@/components/submit-button";
import { FormMessage } from "@/components/ui";
import { initialFormState } from "@/lib/forms/state";
import { updateFeaturedAction } from "./actions";

/** Pick up to 3 trophies or badges to show next to your name in the players directory. */
export function FeaturedForm({
  options,
  selected,
  max,
}: {
  options: { key: string; icon: string; label: string }[];
  selected: string[];
  max: number;
}) {
  const [state, action] = useActionState(updateFeaturedAction, initialFormState);
  if (!options.length) {
    return <p className="text-muted">Earn a trophy or badge to feature it here.</p>;
  }
  return (
    <form action={action}>
      {state.message && <FormMessage tone="ok">{state.message}</FormMessage>}
      {state.error && <FormMessage tone="error">{state.error}</FormMessage>}
      <fieldset className="mb-3">
        <legend className="mb-2 text-sm text-muted">
          Choose up to {max}. They appear next to your name in the players list and on your profile.
        </legend>
        <div className="flex flex-wrap gap-2">
          {options.map((o) => (
            <label
              key={o.key}
              className="flex cursor-pointer items-center gap-2 rounded border border-border px-2 py-1 text-sm has-[:checked]:border-cyan has-[:focus-visible]:outline has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-cyan"
            >
              <input
                type="checkbox"
                name="featured"
                value={o.key}
                defaultChecked={selected.includes(o.key)}
              />
              <span aria-hidden>{o.icon}</span> {o.label}
            </label>
          ))}
        </div>
      </fieldset>
      <SubmitButton pendingText="Saving…" variant="secondary">
        Save featured
      </SubmitButton>
    </form>
  );
}
