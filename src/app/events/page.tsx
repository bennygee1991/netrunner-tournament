import { eventWhen } from "@/components/tournament/event-when";
import type { Metadata } from "next";
import Link from "next/link";
import { EventStatusBadge, formatLine } from "@/components/tournament/status-badge";
import { Card, PageTitle } from "@/components/ui";
import { db } from "@/lib/db";
import { listOneOffEvents } from "@/lib/tournament/one-off";
import { getActiveSeason, pickNextEvent } from "@/lib/tournament/queries";

export const metadata: Metadata = { title: "Events" };

export default async function EventsPage() {
  const [season, oneOffs] = await Promise.all([getActiveSeason(db), listOneOffEvents(db)]);
  const oneOffList = [...oneOffs.upcoming, ...oneOffs.finished];
  const oneOffSection = oneOffList.length > 0 && (
    <section aria-labelledby="one-offs">
      <h2 id="one-offs" className="mt-6 mb-2 font-mono text-sm tracking-widest text-warn uppercase">
        One-off events · no league points
      </h2>
      <ul>
        {oneOffList.map((e) => (
          <li key={e.id}>
            <Card tone="warn">
              <Link href={`/events/${e.id}`} className="flex items-center gap-3 hover:text-cyan">
                <div className="min-w-0 flex-1">
                  <h3 className="text-xl font-bold">{e.name}</h3>
                  <p className="font-mono text-xs text-muted">
                    {eventWhen(e)} ·{" "}
                    {e.status === "SIGNUP" ? `${e._count.signups} signed up` : `${e._count.entrants} players`}
                  </p>
                  <p className="font-mono text-xs text-muted">
                    {formatLine(e.matchFormat, e.cutSize, false, e.cutFormat)}
                  </p>
                </div>
                <EventStatusBadge status={e.status} />
              </Link>
            </Card>
          </li>
        ))}
      </ul>
    </section>
  );
  if (!season) {
    return (
      <>
        <PageTitle kicker="events">Events</PageTitle>
        <Card>
          <p className="py-6 text-center text-muted">No season is running yet. Check back soon.</p>
        </Card>
        {oneOffSection}
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
      {oneOffSection}
    </>
  );
}
