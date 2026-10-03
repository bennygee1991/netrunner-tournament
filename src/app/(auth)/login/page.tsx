import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Card, PageTitle } from "@/components/ui";
import { getCurrentUser, safeNext } from "@/lib/auth/server";
import { LoginForm } from "./login-form";

export const metadata: Metadata = { title: "Log in" };

export default async function LoginPage({ searchParams }: PageProps<"/login">) {
  const next = safeNext((await searchParams).next);
  if (await getCurrentUser()) redirect(next);
  return (
    <>
      <PageTitle kicker="jack in">Log in</PageTitle>
      <Card>
        <LoginForm next={next} />
      </Card>
      <p className="text-sm text-muted">Forgot your password? Ask the organizer for a temporary one.</p>
    </>
  );
}
