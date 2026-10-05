import type { Metadata } from "next";
import Link from "next/link";
import { Notice } from "@/components/notice";
import { EventStatusBadge, formatLine } from "@/components/tournament/status-badge";
import { Card, CardTitle, PageTitle } from "@/components/ui";
import { db } from "@/lib/db";
import { formatDay, todayIso } from "@/lib/tournament/dates";
import { listOneOffEvents } from "@/lib/tournament/one-off";
import { CreateOneOffForm } from "./create-form";

export const metadata: Metadata = { title: "One-off events" };

export default async function AdminOneOffsPage({ searchParams }: PageProps<"/admin/events">) {
  const { notice } = await searchParams;
  const { upcoming, finished } = await listOneOffEvents(db);
  const list = (events: typeof upcoming) => (
    <ul className="divide-y divide-border">
      {events.map((e) => (
        <li key={e.id}>
          <Link href={`/admin/events/${e.id}`} className="flex items-center gap-3 py-3 hover:text-cyan">
            <div className="min-w-0 flex-1">
              <p className="text-lg font-semibold">{e.name}</p>
              <p className="font-mono text-xs text-muted">
                {formatDay(e.date)} · {formatLine(e.matchFormat, e.cutSize, false, e.cutFormat)}
              </p>
              <p className="font-mono text-xs text-muted">
                {e._count.entrants} entrants · {e._count.signups} sign-ups
              </p>
            </div>
            <EventStatusBadge status={e.status} />
          </Link>
        </li>
      ))}
    </ul>
  );
  return (
    <>
      <PageTitle kicker="organizer">One-off events</PageTitle>
      <Notice code={notice} />
      <p className="mb-4 text-sm text-muted">
        Events outside the season: no league points, but players earn one-off trophies and badges and the
        results stay on their profiles.
      </p>
      <Card tone="magenta">
        <CardTitle>Create a one-off event</CardTitle>
        <CreateOneOffForm defaultDate={todayIso()} />
      </Card>
      <Card>
        <CardTitle>Upcoming and running</CardTitle>
        {upcoming.length ? list(upcoming) : <p className="text-muted">None yet.</p>}
      </Card>
      {finished.length > 0 && (
        <Card>
          <CardTitle>Finished</CardTitle>
          {list(finished)}
        </Card>
      )}
    </>
  );
}
