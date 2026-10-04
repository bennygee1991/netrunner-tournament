import { eventWhen } from "@/components/tournament/event-when";
import Link from "next/link";
import { Notice } from "@/components/notice";
import { SignupButton } from "@/components/tournament/signup-button";
import { EventStatusBadge, formatLine } from "@/components/tournament/status-badge";
import { Card, CardTitle, buttonStyles } from "@/components/ui";
import { getCurrentUser } from "@/lib/auth/server";
import { db } from "@/lib/db";
import { formatDay } from "@/lib/tournament/dates";
import { listOneOffEvents } from "@/lib/tournament/one-off";
import { getHomeData } from "@/lib/tournament/queries";

export default async function HomePage({ searchParams }: PageProps<"/">) {
  const { notice } = await searchParams;
  const user = await getCurrentUser();
  const [home, oneOffs] = await Promise.all([getHomeData(db, user?.id ?? null), listOneOffEvents(db)]);
  const mySignups = user
    ? new Set(
        (
          await db.signup.findMany({
            where: { userId: user.id, eventId: { in: oneOffs.upcoming.map((e) => e.id) } },
            select: { eventId: true },
          })
        ).map((s) => s.eventId),
      )
    : new Set<string>();
  const oneOffCard = oneOffs.upcoming.length > 0 && (
    <Card tone="warn">
      <CardTitle>One-off events</CardTitle>
      <p className="mb-2 text-sm text-muted">
        Special events outside the season: no league points, own trophies.
      </p>
      <ul className="divide-y divide-border" aria-label="Upcoming one-off events">
        {oneOffs.upcoming.map((e) => (
          <li key={e.id} className="py-3">
            <div className="mb-1 flex flex-wrap items-baseline justify-between gap-2">
              <Link href={`/events/${e.id}`} className="text-lg font-semibold hover:text-cyan">
                {e.name}
              </Link>
              <span className="font-mono text-sm text-muted">{eventWhen(e)}</span>
            </div>
            <p className="mb-2 font-mono text-xs text-muted">
              {formatLine(e.matchFormat, e.cutSize, false, e.cutFormat)}
            </p>
            {user && e.status === "SIGNUP" ? (
              <SignupButton eventId={e.id} eventName={e.name} signedUp={mySignups.has(e.id)} />
            ) : (
              <EventStatusBadge status={e.status} />
            )}
          </li>
        ))}
      </ul>
    </Card>
  );

  return (
    <>
      <Notice code={notice} />
      <section className="mb-6 space-y-2">
        <p className="font-mono text-xs tracking-widest text-magenta uppercase">&gt; jack in</p>
        <h1 className="text-3xl font-bold tracking-wide uppercase">
          The <span className="text-cyan">Circuit</span>
        </h1>
        <p className="font-mono text-sm text-muted">
          {home
            ? `${home.season.name} · 4 events · one every 2 weeks · prizes after 2 months`
            : "Swiss + top cut · monthly boards · season prizes"}
        </p>
      </section>

      {!home && oneOffCard}
      {!home ? (
        <Card>
          <CardTitle>Sign-ups open soon</CardTitle>
          <p className="text-muted">The next season hasn&apos;t been set up yet. Check back shortly.</p>
          {!user && (
            <div className="mt-4 flex flex-wrap gap-3">
              <Link href="/register" className={buttonStyles.primary}>
                Register
              </Link>
              <Link href="/login" className={buttonStyles.secondary}>
                Log in
              </Link>
            </div>
          )}
        </Card>
      ) : (
        <>
          {home.next ? (
            <Card>
              <p className="font-mono text-xs tracking-widest text-muted uppercase">Next up</p>
              <h2 className="text-2xl font-bold">
                <Link href={`/events/${home.next.id}`} className="hover:text-cyan">
                  {home.next.name}
                </Link>
              </h2>
              <p className="mb-2 font-mono text-sm">{eventWhen(home.next)}</p>
              <p className="font-mono text-xs text-muted">
                {formatLine(home.next.matchFormat, home.next.cutSize, home.next.finale, home.next.cutFormat)}
              </p>
              <div className="mt-4 flex flex-wrap gap-3">
                <Link href={`/events/${home.next.id}`} className={buttonStyles.secondary}>
                  {home.next.status === "SIGNUP" ? "Event details" : "Follow live"}
                </Link>
                <Link href="/rules" className={buttonStyles.secondary}>
                  Corp or Runner? Rules
                </Link>
              </div>
            </Card>
          ) : (
            <Card>
              <CardTitle>All events are complete</CardTitle>
              <Link href="/leaderboards" className={buttonStyles.secondary}>
                See the final boards
              </Link>
            </Card>
          )}

          <Card tone="magenta">
            <CardTitle>{user ? "Sign up to play" : "Register to play"}</CardTitle>
            {home.open.length === 0 ? (
              <p className="text-muted">
                Every event is underway or finished. Follow along on the Events page.
              </p>
            ) : !user ? (
              <>
                <p className="mb-4 text-muted">
                  Create an account with your runner name, then sign up for events here.
                </p>
                <div className="flex flex-wrap gap-3">
                  <Link href="/register" className={buttonStyles.primary}>
                    Register
                  </Link>
                  <Link href="/login?next=/" className={buttonStyles.secondary}>
                    Log in
                  </Link>
                </div>
              </>
            ) : (
              <ul className="divide-y divide-border">
                {home.open.map((e) => (
                  <li key={e.id} className="py-3">
                    <div className="mb-2 flex flex-wrap items-baseline justify-between gap-2">
                      <Link href={`/events/${e.id}`} className="text-lg font-semibold hover:text-cyan">
                        {e.name}
                      </Link>
                      <span className="font-mono text-sm text-muted">{eventWhen(e)}</span>
                    </div>
                    <SignupButton eventId={e.id} eventName={e.name} signedUp={e.mine} />
                  </li>
                ))}
              </ul>
            )}
          </Card>

          {home.open.map((e) => (
            <Card key={e.id}>
              <div className="flex items-baseline justify-between gap-2">
                <h2 className="text-lg font-bold">{e.name}</h2>
                <EventStatusBadge status={e.status} />
              </div>
              <p className="mb-2 font-mono text-xs text-muted">
                {formatDay(e.date)} · {e.signups.length} signed up
              </p>
              {e.signups.length ? (
                <ul className="flex flex-wrap gap-2" aria-label={`Signed up for ${e.name}`}>
                  {e.signups.map((n) => (
                    <li key={n} className="rounded border border-border px-2 py-1 text-sm">
                      {n}
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-sm text-muted">Be the first to sign up.</p>
              )}
            </Card>
          ))}
          {oneOffCard}
        </>
      )}
    </>
  );
}
