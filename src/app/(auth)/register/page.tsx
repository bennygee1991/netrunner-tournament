import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Card, PageTitle } from "@/components/ui";
import { getCurrentUser } from "@/lib/auth/server";
import { RegisterForm } from "./register-form";

export const metadata: Metadata = { title: "Register" };

export default async function RegisterPage() {
  if (await getCurrentUser()) redirect("/account");
  return (
    <>
      <PageTitle kicker="new runner">Register</PageTitle>
      <Card tone="magenta">
        <RegisterForm />
      </Card>
      <p className="text-sm text-muted">
        Forgot your password later? The organizer can give you a one-time temporary password.
      </p>
    </>
  );
}
