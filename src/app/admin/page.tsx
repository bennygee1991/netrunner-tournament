import type { Metadata } from "next";
import Link from "next/link";
import { Card, CardTitle, PageTitle, buttonStyles } from "@/components/ui";
import { db } from "@/lib/db";

export const metadata: Metadata = { title: "Admin" };

export default async function AdminDashboard() {
  const [players, disabled, admins] = await Promise.all([
    db.user.count(),
    db.user.count({ where: { disabledAt: { not: null } } }),
    db.user.count({ where: { role: "ADMIN" } }),
  ]);
  return (
    <>
      <PageTitle kicker="organizer">Dashboard</PageTitle>
      <Card>
        <CardTitle>Players</CardTitle>
        <dl className="mb-4 grid grid-cols-3 gap-2 text-center font-mono">
          <div>
            <dt className="text-xs text-muted uppercase">Accounts</dt>
            <dd className="text-2xl text-cyan">{players}</dd>
          </div>
          <div>
            <dt className="text-xs text-muted uppercase">Disabled</dt>
            <dd className="text-2xl">{disabled}</dd>
          </div>
          <div>
            <dt className="text-xs text-muted uppercase">Admins</dt>
            <dd className="text-2xl">{admins}</dd>
          </div>
        </dl>
        <Link href="/admin/players" className={buttonStyles.secondary}>
          Manage players
        </Link>
      </Card>
      <Card tone="magenta">
        <CardTitle>Seasons and events</CardTitle>
        <p className="text-muted">Season and event tools arrive in the next milestone.</p>
      </Card>
    </>
  );
}
