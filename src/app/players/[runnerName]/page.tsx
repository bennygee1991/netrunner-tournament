import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Avatar } from "@/components/avatar";
import { Badge, Card, CardTitle, PageTitle } from "@/components/ui";
import { db } from "@/lib/db";
import { formatDate } from "@/lib/format";
import { formatDay } from "@/lib/tournament/dates";
import { getProfile } from "@/lib/tournament/profiles";

function decode(raw: string): string {
  try {
    return decodeURIComponent(raw);
  } catch {
    return "";
  }
}

export async function generateMetadata({ params }: PageProps<"/players/[runnerName]">): Promise<Metadata> {
  return { title: decode((await params).runnerName) || "Player" };
}

export default async function PlayerPage({ params }: PageProps<"/players/[runnerName]">) {
  const name = decode((await params).runnerName);
  const profile = name ? await getProfile(db, name) : null;
  if (!profile) notFound();
  const { user, stats, cabinet, standing, records } = profile;

  return (
    <>
      <div className="mb-2 flex items-center gap-4">
        <Avatar avatar={user.avatar} seed={user.id} size={72} />
        <PageTitle kicker="runner">{user.runnerName}</PageTitle>
      </div>
      <p className="mb-4 font-mono text-xs text-muted">
        Member since {formatDate(user.createdAt)}{" "}
        {user.role === "ADMIN" && <Badge tone="cyan">Organizer</Badge>}
      </p>
      {user.bio && <p className="mb-4 whitespace-pre-line">{user.bio}</p>}

      <Card tone="warn">
        <CardTitle>Trophy cabinet</CardTitle>
        <p className="mb-3 text-sm">
          <Link href="/trophies" className="text-cyan underline">
            See every trophy in the Hall of champions
          </Link>
        </p>
        {cabinet.length === 0 ? (
          <p className="text-muted">No trophies yet. Play an event to earn the first one.</p>
        ) : (
          <ul className="grid grid-cols-1 gap-2 sm:grid-cols-2" aria-label="Trophies">
            {cabinet.map((t, i) => (
              <li key={`${t.kind}-${i}`} className="flex items-center gap-3 rounded border border-border p-2">
                <span className="text-2xl" aria-hidden>
                  {t.icon}
                </span>
                <span className="min-w-0">
                  <span className="block font-semibold">{t.label}</span>
                  <span className="block truncate font-mono text-xs text-muted">{t.detail}</span>
                </span>
              </li>
            ))}
          </ul>
        )}
      </Card>

      <Card>
        <CardTitle>Stats</CardTitle>
        <dl className="grid grid-cols-3 gap-3 text-center font-mono">
          <div>
            <dt className="text-[11px] text-muted uppercase">Events</dt>
            <dd className="text-2xl text-cyan">{stats.events}</dd>
          </div>
          <div>
            <dt className="text-[11px] text-muted uppercase">Event wins</dt>
            <dd className="text-2xl text-cyan">{stats.titles}</dd>
          </div>
          <div>
            <dt className="text-[11px] text-muted uppercase">League pts</dt>
            <dd className="text-2xl text-cyan">{stats.leaguePoints}</dd>
          </div>
          <div className="col-span-3">
            <dt className="text-[11px] text-muted uppercase">Swiss games W-D-L</dt>
            <dd className="text-lg">
              {stats.wins}-{stats.draws}-{stats.losses}
            </dd>
          </div>
        </dl>
        {standing && (
          <p className="mt-3 text-center font-mono text-sm">
            {standing.seasonName}: <span className="text-cyan">#{standing.rank}</span> of {standing.of} with{" "}
            {standing.total} pts
          </p>
        )}
      </Card>

      <Card tone="magenta">
        <CardTitle>Event history</CardTitle>
        {records.length === 0 ? (
          <p className="text-muted">No finished events yet.</p>
        ) : (
          <ul className="divide-y divide-border">
            {records.map((r) => (
              <li key={r.id} className="flex items-center justify-between gap-2 py-2">
                <span className="min-w-0">
                  <span className="block font-semibold">
                    {r.eventName} {r.champion && <span aria-label="champion">⭐</span>}
                  </span>
                  <span className="block font-mono text-xs text-muted">
                    {formatDay(r.eventDate)} · {r.seasonName} · {r.wins}-{r.draws}-{r.losses}
                  </span>
                </span>
                <span className="shrink-0 text-right font-mono text-sm">
                  <span className={r.champion ? "block text-warn" : "block"}>{r.placing}</span>
                  <span className="block text-cyan">+{r.points}</span>
                </span>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </>
  );
}
