"use client";

import Link from "next/link";
import { useActionState } from "react";
import { SubmitButton } from "@/components/submit-button";
import { Field, FormMessage, buttonStyles } from "@/components/ui";
import { initialFormState } from "@/lib/forms/state";
import { PASSWORD_MIN, RUNNER_NAME_MAX, RUNNER_NAME_MIN } from "@/lib/validation";
import { registerAction } from "../actions";

export function RegisterForm() {
  const [state, action] = useActionState(registerAction, initialFormState);
  const fe = state.fieldErrors ?? {};
  return (
    <form action={action} noValidate>
      {state.error && <FormMessage tone="error">{state.error}</FormMessage>}
      <Field
        label="Runner name"
        name="runnerName"
        autoComplete="username"
        autoCapitalize="none"
        required
        minLength={RUNNER_NAME_MIN}
        maxLength={RUNNER_NAME_MAX}
        defaultValue={state.values?.runnerName}
        error={fe.runnerName}
        hint={`This is your username and the name on the boards. ${RUNNER_NAME_MIN}-${RUNNER_NAME_MAX} letters, digits, spaces, _ or -.`}
      />
      <Field
        label="Password"
        name="password"
        type="password"
        autoComplete="new-password"
        required
        minLength={PASSWORD_MIN}
        error={fe.password}
        hint={`At least ${PASSWORD_MIN} characters. A short phrase works well.`}
      />
      <Field
        label="Confirm password"
        name="confirm"
        type="password"
        autoComplete="new-password"
        required
        error={fe.confirm}
      />
      <Field
        label="Email (optional)"
        name="email"
        type="email"
        autoComplete="email"
        defaultValue={state.values?.email}
        error={fe.email}
        hint="Only visible to the organizer. Not used for mailing lists."
      />
      <div className="flex flex-wrap items-center gap-4">
        <SubmitButton pendingText="Creating…">Create account</SubmitButton>
        <Link href="/login" className={buttonStyles.link}>
          Already registered? Log in
        </Link>
      </div>
    </form>
  );
}
