import type { Metadata } from "next";
import Link from "next/link";
import { Badge, Card, CardTitle, FormMessage, PageTitle, buttonStyles } from "@/components/ui";
import { readPrefs } from "@/lib/auth/accounts";
import { requireUser } from "@/lib/auth/server";
import { db } from "@/lib/db";
import { formatDate } from "@/lib/format";
import { ProfileForm } from "./profile-form";

export const metadata: Metadata = { title: "Account" };

export default async function AccountPage({ searchParams }: PageProps<"/account">) {
  const sessionUser = await requireUser();
  const sp = await searchParams;
  const user = await db.user.findUniqueOrThrow({
    where: { id: sessionUser.id },
    select: { runnerName: true, email: true, prefs: true, role: true, createdAt: true },
  });
  const signups = await db.signup.findMany({
    where: { userId: sessionUser.id },
    include: { event: { select: { id: true, name: true, date: true, status: true } } },
    orderBy: { event: { date: "asc" } },
  });

  return (
    <>
      <PageTitle kicker="account">{user.runnerName}</PageTitle>
      {sp.welcome && (
        <FormMessage tone="ok">Welcome to the Circuit, {user.runnerName}. You are registered.</FormMessage>
      )}
      {sp.changed && <FormMessage tone="ok">Password changed.</FormMessage>}

      <Card>
        <CardTitle>Profile</CardTitle>
        <p className="mb-1 font-mono text-sm text-muted">
          Member since {formatDate(user.createdAt)}{" "}
          {user.role === "ADMIN" && <Badge tone="cyan">Admin</Badge>}
        </p>
        <p className="mb-4 font-mono text-sm">
          <Link className={buttonStyles.link} href={`/players/${encodeURIComponent(user.runnerName)}`}>
            View public profile
          </Link>
        </p>
        <ProfileForm theme={readPrefs(user.prefs).theme} email={user.email ?? ""} />
      </Card>

      <Card tone="magenta">
        <CardTitle>My sign-ups</CardTitle>
        {signups.length === 0 ? (
          <p className="text-muted">You have not signed up for any events yet.</p>
        ) : (
          <ul className="space-y-2">
            {signups.map((s) => (
              <li key={s.id} className="flex items-center justify-between gap-2">
                <Link href={`/events/${s.event.id}`} className="font-semibold hover:text-cyan">
                  {s.event.name}
                </Link>
                <span className="font-mono text-sm text-muted">{formatDate(s.event.date)}</span>
              </li>
            ))}
          </ul>
        )}
      </Card>

      <Card tone="warn">
        <CardTitle>My results</CardTitle>
        <p className="text-muted">Your event results and trophies will show here after your first event.</p>
      </Card>

      <Card>
        <CardTitle>Security</CardTitle>
        <Link href="/account/password" className={buttonStyles.secondary}>
          Change password
        </Link>
      </Card>
    </>
  );
}
