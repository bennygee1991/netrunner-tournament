import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Avatar } from "@/components/avatar";
import { Badge, Card, CardTitle, PageTitle } from "@/components/ui";
import { getCurrentUser } from "@/lib/auth/server";
import { db } from "@/lib/db";
import { BADGE_GROUPS, iconOf } from "@/lib/tournament/badges";
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

function rarityLine(held: number, of: number): string {
  if (!of) return "";
  const pct = Math.round((held / of) * 100);
  return `Held by ${held} of ${of} player${of === 1 ? "" : "s"} (${pct}%)`;
}

export default async function PlayerPage({ params }: PageProps<"/players/[runnerName]">) {
  const name = decode((await params).runnerName);
  const [profile, viewer] = await Promise.all([name ? getProfile(db, name) : null, getCurrentUser()]);
  if (!profile) notFound();
  const { user, stats, cabinet, badges, locked, featured, standing, records } = profile;
  const own = viewer?.id === user.id;

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
      {featured.length > 0 && (
        <ul className="mb-3 flex flex-wrap gap-2" aria-label="Featured trophies and badges">
          {featured.map((k) => {
            const i = iconOf(k)!;
            return (
              <li key={k} className="rounded border border-border px-2 py-1 text-sm">
                <span aria-hidden>{i.icon}</span> {i.label}
              </li>
            );
          })}
        </ul>
      )}
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

      <Card tone="magenta">
        <CardTitle>Badges</CardTitle>
        {badges.length === 0 ? (
          <p className="text-muted">No badges yet. Play an event to earn the first one.</p>
        ) : (
          <ul className="grid grid-cols-1 gap-2 sm:grid-cols-2" aria-label="Badges">
            {badges.map((b) => (
              <li key={b.key} className="flex items-center gap-3 rounded border border-border p-2">
                <span className="text-2xl" aria-hidden>
                  {b.icon}
                </span>
                <span className="min-w-0">
                  <span className="block font-semibold">{b.label}</span>
                  <span className="block text-xs text-muted">{b.earnedAt ?? b.description}</span>
                  <span className="block font-mono text-[11px] text-muted">{rarityLine(b.held, b.of)}</span>
                </span>
              </li>
            ))}
          </ul>
        )}
        {own && locked.length > 0 && (
          <details className="mt-4">
            <summary className="cursor-pointer font-mono text-sm text-cyan">
              Still to unlock ({locked.length})
            </summary>
            <p className="mt-2 mb-2 text-xs text-muted">Only you see this list.</p>
            {BADGE_GROUPS.map(({ group, label }) => {
              const list = locked.filter((b) => b.group === group);
              if (!list.length) return null;
              return (
                <section key={group} className="mb-3">
                  <h3 className="mb-1 font-mono text-xs tracking-widest text-muted uppercase">{label}</h3>
                  <ul className="space-y-1" aria-label={`Locked: ${label}`}>
                    {list.map((b) => (
                      <li key={b.key} className="flex items-center gap-2 text-sm text-muted">
                        <span className="opacity-50 grayscale" aria-hidden>
                          {b.icon}
                        </span>
                        <span>
                          <span className="font-semibold">{b.label}</span>: {b.description}
                        </span>
                      </li>
                    ))}
                  </ul>
                </section>
              );
            })}
          </details>
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
                  <span className="block text-cyan">{r.oneOff ? "one-off" : `+${r.points}`}</span>
                </span>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </>
  );
}
