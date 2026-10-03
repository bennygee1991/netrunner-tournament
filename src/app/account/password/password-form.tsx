"use client";

import { useActionState } from "react";
import { SubmitButton } from "@/components/submit-button";
import { Field, FormMessage } from "@/components/ui";
import { initialFormState } from "@/lib/forms/state";
import { PASSWORD_MIN } from "@/lib/validation";
import { changePasswordAction } from "../actions";

export function PasswordForm({ forced }: { forced: boolean }) {
  const [state, action] = useActionState(changePasswordAction, initialFormState);
  const fe = state.fieldErrors ?? {};
  return (
    <form action={action} noValidate>
      {state.error && <FormMessage tone="error">{state.error}</FormMessage>}
      <Field
        label={forced ? "Temporary password" : "Current password"}
        name="current"
        type="password"
        autoComplete="current-password"
        required
        error={fe.current}
      />
      <Field
        label="New password"
        name="password"
        type="password"
        autoComplete="new-password"
        required
        minLength={PASSWORD_MIN}
        error={fe.password}
        hint={`At least ${PASSWORD_MIN} characters.`}
      />
      <Field
        label="Confirm new password"
        name="confirm"
        type="password"
        autoComplete="new-password"
        required
        error={fe.confirm}
      />
      <SubmitButton pendingText="Saving…">Change password</SubmitButton>
    </form>
  );
}
