"use client";

import { ActionForm } from "@/components/action-form";
import { SubmitButton } from "@/components/submit-button";
import { signUpAction, withdrawAction } from "@/app/signup-actions";

export function SignupButton({
  eventId,
  eventName,
  signedUp,
}: {
  eventId: string;
  eventName: string;
  signedUp: boolean;
}) {
  return signedUp ? (
    <ActionForm action={withdrawAction} fields={{ eventId }}>
      <p className="mb-2 font-mono text-sm text-ok">✓ You&apos;re signed up</p>
      <SubmitButton variant="secondary" pendingText="Withdrawing…">
        <span className="sr-only">{eventName}: </span>Withdraw
      </SubmitButton>
    </ActionForm>
  ) : (
    <ActionForm action={signUpAction} fields={{ eventId }}>
      <SubmitButton pendingText="Signing up…">
        Sign up<span className="sr-only"> for {eventName}</span>
      </SubmitButton>
    </ActionForm>
  );
}
