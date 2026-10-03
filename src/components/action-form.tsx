"use client";

import { type ReactNode, useActionState } from "react";
import { FormMessage, cx } from "@/components/ui";
import type { FormState } from "@/lib/forms/state";

/**
 * A small form bound to a server action with inline error/success messages.
 * Children are the inputs and submit buttons; `fields` become hidden inputs.
 */
export function ActionForm({
  action,
  fields = {},
  children,
  className,
  showMessage = true,
}: {
  action: (state: FormState, form: FormData) => Promise<FormState>;
  fields?: Record<string, string | number>;
  children: ReactNode;
  className?: string;
  showMessage?: boolean;
}) {
  const [state, formAction, pending] = useActionState(action, {});
  return (
    <form action={formAction} className={cx(className, pending && "opacity-70")} aria-busy={pending}>
      {Object.entries(fields).map(([k, v]) => (
        <input key={k} type="hidden" name={k} value={v} />
      ))}
      {state.error && <FormMessage tone="error">{state.error}</FormMessage>}
      {showMessage && state.message && <FormMessage tone="ok">{state.message}</FormMessage>}
      {children}
    </form>
  );
}
