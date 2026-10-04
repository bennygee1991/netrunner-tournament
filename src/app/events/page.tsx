import { eventWhen } from "@/components/tournament/event-when";
import type { Metadata } from "next";
import Link from "next/link";
import { EventStatusBadge, formatLine } from "@/components/tournament/status-badge";
import { Card, PageTitle } from "@/components/ui";
import { db } from "@/lib/db";
import { getActiveSeason, pickNextEvent } from "@/lib/tournament/queries";

export const metadata: Metadata = { title: "Events" };

export default async function EventsPage() {
  const season = await getActiveSeason(db);
  if (!season) {
    return (
      <>
        <PageTitle kicker="events">Events</PageTitle>
        <Card>
          <p className="py-6 text-center text-muted">No season is running yet. Check back soon.</p>
        </Card>
      </>
    );
  }
  const next = pickNextEvent(season.events);
  return (
    <>
      <PageTitle kicker={season.name}>Events</PageTitle>
      <ul>
        {season.events.map((e) => (
          <li key={e.id}>
            <Card tone={next?.id === e.id ? "magenta" : "cyan"}>
              <Link href={`/events/${e.id}`} className="flex items-center gap-3 hover:text-cyan">
                <div className="min-w-0 flex-1">
                  <h2 className="text-xl font-bold">{e.name}</h2>
                  <p className="font-mono text-xs text-muted">
                    {eventWhen(e)} · Month {e.month} ·{" "}
                    {e.status === "SIGNUP" ? `${e._count.signups} signed up` : `${e._count.entrants} players`}
                  </p>
                  <p className="font-mono text-xs text-muted">
                    {formatLine(e.matchFormat, e.cutSize, e.finale, e.cutFormat)}
                  </p>
                </div>
                <EventStatusBadge status={e.status} />
              </Link>
            </Card>
          </li>
        ))}
      </ul>
    </>
  );
}
