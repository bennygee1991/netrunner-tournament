"use client";

import Link from "next/link";
import { useActionState } from "react";
import { SubmitButton } from "@/components/submit-button";
import { Field, FormMessage, buttonStyles } from "@/components/ui";
import { initialFormState } from "@/lib/forms/state";
import { loginAction } from "../actions";

export function LoginForm({ next }: { next: string }) {
  const [state, action] = useActionState(loginAction, initialFormState);
  return (
    <form action={action}>
      {state.error && <FormMessage tone="error">{state.error}</FormMessage>}
      <input type="hidden" name="next" value={next} />
      <Field
        label="Runner name"
        name="runnerName"
        autoComplete="username"
        autoCapitalize="none"
        required
        defaultValue={state.values?.runnerName}
      />
      <Field label="Password" name="password" type="password" autoComplete="current-password" required />
      <div className="flex flex-wrap items-center gap-4">
        <SubmitButton pendingText="Jacking in…">Log in</SubmitButton>
        <Link href="/register" className={buttonStyles.link}>
          New here? Register
        </Link>
      </div>
    </form>
  );
}
