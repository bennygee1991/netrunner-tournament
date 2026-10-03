"use client";

import { type ReactNode, useActionState, useState } from "react";
import { SubmitButton } from "./submit-button";
import { FormMessage } from "./ui";
import type { FormState } from "@/lib/forms/state";

/**
 * Destructive action guarded by typing an exact phrase. The button stays disabled until the phrase
 * matches; the server checks it again.
 */
export function TypedConfirmForm({
  action,
  phrase,
  fields = {},
  label,
  buttonText,
  children,
  id,
}: {
  action: (s: FormState, f: FormData) => Promise<FormState>;
  phrase: string;
  fields?: Record<string, string>;
  label: string;
  buttonText: string;
  children?: ReactNode;
  id: string;
}) {
  const [state, formAction] = useActionState(action, {});
  const [typed, setTyped] = useState("");
  return (
    <form action={formAction}>
      {Object.entries(fields).map(([k, v]) => (
        <input key={k} type="hidden" name={k} value={v} />
      ))}
      {state.error && <FormMessage tone="error">{state.error}</FormMessage>}
      {state.message && <FormMessage tone="ok">{state.message}</FormMessage>}
      {children}
      <div className="mb-4 flex flex-col gap-1">
        <label htmlFor={id} className="font-mono text-xs tracking-widest text-muted uppercase">
          {label}
        </label>
        <input
          id={id}
          name="confirm"
          value={typed}
          onChange={(e) => setTyped(e.target.value)}
          autoComplete="off"
          autoCapitalize="none"
          spellCheck={false}
          className="min-h-11 rounded border border-border bg-bg px-3 py-2 font-mono text-base text-fg focus:border-danger"
        />
      </div>
      <SubmitButton variant="danger" disabled={typed.trim() !== phrase} pendingText="Working…">
        {buttonText}
      </SubmitButton>
    </form>
  );
}
