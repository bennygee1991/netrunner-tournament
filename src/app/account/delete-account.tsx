"use client";

import { TypedConfirmForm } from "@/components/typed-confirm";
import { deleteMyAccountAction } from "./actions";

export function DeleteAccountForm({ runnerName }: { runnerName: string }) {
  return (
    <TypedConfirmForm
      id="delete-me"
      action={deleteMyAccountAction}
      phrase={runnerName}
      label={`Type "${runnerName}" to confirm`}
      buttonText="Delete my account"
    >
      <p className="mb-3 text-sm text-muted">
        This deletes your account, sign-ups and profile. Results in past events stay so standings still add
        up, but under the name &quot;Deleted player&quot; instead of yours. This cannot be undone.
      </p>
      <div className="mb-4 flex flex-col gap-1">
        <label htmlFor="delete-password" className="font-mono text-xs tracking-widest text-muted uppercase">
          Your password
        </label>
        <input
          id="delete-password"
          name="password"
          type="password"
          autoComplete="current-password"
          className="min-h-11 rounded border border-border bg-bg px-3 py-2 font-mono text-base text-fg focus:border-danger"
        />
      </div>
    </TypedConfirmForm>
  );
}
