import type { Metadata } from "next";
import Link from "next/link";
import { Card, CardTitle, PageTitle, buttonStyles } from "@/components/ui";
import { db } from "@/lib/db";
import { formatDay } from "@/lib/tournament/dates";
import { getActiveSeason } from "@/lib/tournament/queries";

export const metadata: Metadata = { title: "Admin" };

export default async function AdminDashboard() {
  const [season, players, disabled, admins] = await Promise.all([
    getActiveSeason(db),
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
        <CardTitle>Season</CardTitle>
        {season ? (
          <>
            <p className="mb-2 text-lg font-semibold">{season.name}</p>
            <ul className="mb-4 space-y-1 font-mono text-sm">
              {season.events.map((e) => (
                <li key={e.id} className="flex items-center justify-between gap-2">
                  <Link href={`/admin/events/${e.id}`} className="hover:text-cyan">
                    {e.name} · {formatDay(e.date)}
                  </Link>
                  <span className="text-muted">
                    {e.status === "SIGNUP" ? `${e._count.signups} signed up` : e.status.toLowerCase()}
                  </span>
                </li>
              ))}
            </ul>
          </>
        ) : (
          <p className="mb-4 text-muted">No season is running.</p>
        )}
        <Link href="/admin/season" className={buttonStyles.secondary}>
          {season ? "Manage season" : "Start a season"}
        </Link>
      </Card>
      <Card tone="warn">
        <CardTitle>Backup</CardTitle>
        <p className="mb-3 text-sm text-muted">
          Download everything (players, seasons, events, results, trophies, audit log) as one file. Keep it
          somewhere private: it contains emails and scrambled passwords. Do this before archiving a season or
          resetting.
        </p>
        <form method="post" action="/admin/backup">
          <button type="submit" className={buttonStyles.secondary}>
            Download backup
          </button>
        </form>
      </Card>
    </>
  );
}
