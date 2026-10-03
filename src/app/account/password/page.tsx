import type { Metadata } from "next";
import { Card, FormMessage, PageTitle } from "@/components/ui";
import { requireUser } from "@/lib/auth/server";
import { PasswordForm } from "./password-form";

export const metadata: Metadata = { title: "Change password" };

export default async function ChangePasswordPage() {
  const user = await requireUser({ allowForcedChange: true });
  return (
    <>
      <PageTitle kicker="account">Change password</PageTitle>
      {user.mustChangePassword && (
        <FormMessage tone="error">
          You logged in with a temporary password. Choose a new one to continue.
        </FormMessage>
      )}
      <Card>
        <PasswordForm forced={user.mustChangePassword} />
      </Card>
      <p className="text-sm text-muted">Changing your password logs you out on every other device.</p>
    </>
  );
}
