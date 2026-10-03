import { eventWhen } from "@/components/tournament/event-when";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { LiveRefresh } from "@/components/live-refresh";
import { MatchCard } from "@/components/tournament/match-card";
import { ResultsTable } from "@/components/tournament/results-table";
import { SignupButton } from "@/components/tournament/signup-button";
import { StandingsTable } from "@/components/tournament/standings-table";
import { EventStatusBadge, formatLine } from "@/components/tournament/status-badge";
import { Card, CardTitle, PageTitle, buttonStyles } from "@/components/ui";
import { getCurrentUser } from "@/lib/auth/server";
import { db } from "@/lib/db";
import { getEventView } from "@/lib/tournament/queries";

export async function generateMetadata({ params }: PageProps<"/events/[id]">): Promise<Metadata> {
  const { id } = await params;
  const ev = id.length <= 64 ? await db.event.findUnique({ where: { id }, select: { name: true } }) : null;
  return { title: ev?.name ?? "Event" };
}

export default async function EventPage({ params }: PageProps<"/events/[id]">) {
  const { id } = await params;
  const [view, user] = await Promise.all([getEventView(db, id), getCurrentUser()]);
  if (!view) notFound();
  const { meta } = view;
  const double = meta.matchFormat === "DOUBLE";
  const live = meta.status === "SWISS" || meta.status === "CUT";
  const profiles = new Map(view.entrants.map((e) => [e.id, e.userId ? e.name : null]));
  const profileOf = (id: string) => profiles.get(id) ?? null;
  const signedUp = user ? (await db.signup.count({ where: { eventId: id, userId: user.id } })) > 0 : false;

  return (
    <>
      {live && <LiveRefresh />}
      <PageTitle kicker={meta.seasonName}>{meta.name}</PageTitle>
      <div className="mb-4 flex flex-wrap items-center gap-3 font-mono text-sm text-muted">
        <EventStatusBadge status={meta.status} round={view.swiss.length} />
        <span>{eventWhen(meta)}</span>
        <span>Month {meta.month}</span>
        {user?.role === "ADMIN" && (
          <Link href={`/admin/events/${meta.id}`} className={buttonStyles.link}>
            Run this event
          </Link>
        )}
      </div>
      <p className="mb-4 font-mono text-xs text-muted">
        {formatLine(meta.matchFormat, meta.cutSize)}
        {meta.cutSize === 8 &&
          " · single elimination (house rule; official top 8 cuts are double elimination)"}
      </p>

      {meta.notes && (
        <Card>
          <CardTitle>Event info</CardTitle>
          <p className="whitespace-pre-line">{meta.notes}</p>
        </Card>
      )}

      {meta.status === "SIGNUP" && (
        <Card tone="magenta">
          <CardTitle>Sign-up</CardTitle>
          {meta.seasonActive && user ? (
            <SignupButton eventId={meta.id} eventName={meta.name} signedUp={signedUp} />
          ) : (
            <p className="mb-2 text-muted">
              <Link href={`/login?next=/events/${meta.id}`} className={buttonStyles.link}>
                Log in
              </Link>{" "}
              or{" "}
              <Link href="/register" className={buttonStyles.link}>
                register
              </Link>{" "}
              to sign up.
            </p>
          )}
          <h3 className="mt-4 mb-2 font-mono text-xs tracking-widest text-muted uppercase">
            Confirmed entrants ({view.entrants.length})
          </h3>
          {view.entrants.length ? (
            <ul className="flex flex-wrap gap-2">
              {view.entrants.map((e) => (
                <li key={e.id} className="rounded border border-border px-2 py-1 text-sm">
                  {e.name}
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-muted">No confirmed entrants yet.</p>
          )}
        </Card>
      )}

      {view.results && (
        <Card tone="warn">
          <CardTitle>Final results</CardTitle>
          <ResultsTable results={view.results} nameOf={view.loaded.nameOf} profileOf={profileOf} />
        </Card>
      )}

      {view.cut.length > 0 && (
        <Card tone="warn">
          <CardTitle>Top cut</CardTitle>
          {[...view.cut].reverse().map((r) => (
            <section key={r.index} className="mb-3">
              <h3 className="mb-1 font-mono text-sm tracking-widest text-magenta uppercase">{r.label}</h3>
              {r.matches.map((m) => (
                <MatchCard key={m.index} match={m} double={false} />
              ))}
            </section>
          ))}
        </Card>
      )}

      {view.swiss.length > 0 && (
        <Card>
          <CardTitle>
            Swiss · {view.swiss.length} of {meta.effectiveSwissRounds} rounds
          </CardTitle>
          {[...view.swiss].reverse().map((r, i) => (
            <details
              key={r.index}
              open={i === 0 && meta.status === "SWISS"}
              className="border-t border-border py-2"
            >
              <summary className="cursor-pointer font-mono text-sm tracking-widest text-muted uppercase">
                {r.label}
                {!r.complete && " · in progress"}
              </summary>
              {r.matches.map((m) => (
                <MatchCard key={m.index} match={m} double={double} table={m.b ? m.index + 1 : undefined} />
              ))}
            </details>
          ))}
        </Card>
      )}

      {view.standings.length > 0 && (
        <Card>
          <CardTitle>Standings</CardTitle>
          <StandingsTable
            standings={view.standings}
            nameOf={view.loaded.nameOf}
            profileOf={profileOf}
            cutSize={
              meta.status === "SWISS" || meta.status === "CUT" || meta.status === "DONE" ? meta.cutSize : 0
            }
            double={double}
            dropped={new Set(view.loaded.state.dropped)}
          />
        </Card>
      )}
    </>
  );
}
