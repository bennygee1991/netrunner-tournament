import type { Metadata } from "next";
import Link from "next/link";
import { Avatar } from "@/components/avatar";
import { Card, CardTitle, PageTitle } from "@/components/ui";
import { db } from "@/lib/db";
import { formatDate } from "@/lib/format";
import { type HallPlayer, getHallOfChampions } from "@/lib/tournament/community";
import { BADGE_GROUPS, STORED_TROPHIES } from "@/lib/tournament/badges";

export const metadata: Metadata = { title: "Hall of champions" };

function Who({ p, size = 32 }: { p: HallPlayer; size?: number }) {
  const inner = (
    <>
      <Avatar avatar={p.avatar} seed={p.seed} size={size} />
      <span className="truncate font-semibold">{p.name}</span>
    </>
  );
  return p.profile ? (
    <Link
      href={`/players/${encodeURIComponent(p.profile)}`}
      className="flex min-w-0 items-center gap-2 hover:text-cyan"
    >
      {inner}
    </Link>
  ) : (
    <span className="flex min-w-0 items-center gap-2">{inner}</span>
  );
}

function Holders({ label, holders }: { label: string; holders: HallPlayer[] }) {
  const list = (
    <ul className="flex flex-wrap gap-3" aria-label={`${label} holders`}>
      {holders.map((h) => (
        <li key={h.seed}>
          <Who p={h} size={28} />
        </li>
      ))}
    </ul>
  );
  // Long lists (everyone has "Jacked in") stay folded so the page stays short on phones.
  if (holders.length <= 8) return list;
  return (
    <details>
      <summary className="cursor-pointer text-sm text-cyan">Show all {holders.length} holders</summary>
      <div className="mt-2">{list}</div>
    </details>
  );
}

export default async function TrophiesPage() {
  const hall = await getHallOfChampions(db);
  return (
    <>
      <PageTitle kicker="trophy cabinet">Hall of champions</PageTitle>
      <nav aria-label="Sections" className="mb-4 flex flex-wrap gap-2 font-mono text-xs">
        {[
          ["#seasons", "Season champions"],
          ["#months", "Month champions"],
          ["#events", "Event champions"],
          ["#badges", "Badges"],
        ].map(([href, label]) => (
          <a key={href} href={href} className="rounded border border-border px-2 py-1 hover:border-cyan">
            {label}
          </a>
        ))}
        <Link
          href="/leaderboards?board=past"
          className="rounded border border-border px-2 py-1 hover:border-cyan"
        >
          Past season boards
        </Link>
      </nav>

      <Card tone="warn" id="seasons" className="scroll-mt-20">
        <CardTitle>Season champions</CardTitle>
        {hall.seasons.length === 0 ? (
          <p className="text-muted">Awarded when the first season ends.</p>
        ) : (
          <ul className="space-y-4">
            {hall.seasons.map((s) => (
              <li key={s.seasonName + s.awardedAt.toISOString()}>
                <p className="mb-2 font-mono text-xs tracking-widest text-muted uppercase">
                  {s.seasonName} · {formatDate(s.awardedAt)}
                </p>
                <ol className="space-y-2">
                  {s.places.map((pl, i) => (
                    <li key={i} className="flex items-center gap-3">
                      <span className="w-8 text-center text-2xl" aria-label={STORED_TROPHIES[pl.kind]?.label}>
                        {STORED_TROPHIES[pl.kind]?.icon}
                      </span>
                      <Who p={pl.player} size={i === 0 ? 44 : 32} />
                    </li>
                  ))}
                </ol>
              </li>
            ))}
          </ul>
        )}
      </Card>

      <Card id="months" className="scroll-mt-20">
        <CardTitle>Month champions</CardTitle>
        {hall.monthChampions.length === 0 ? (
          <p className="text-muted">Awarded from the Month 1 and Month 2 boards when a season ends.</p>
        ) : (
          <ul className="divide-y divide-border">
            {hall.monthChampions.map((m) => (
              <li key={m.id} className="flex items-center justify-between gap-3 py-2">
                <Who p={m.player} />
                <span className="shrink-0 text-right font-mono text-xs text-muted">
                  🗓️ Month {m.month}
                  <br />
                  {m.seasonName}
                </span>
              </li>
            ))}
          </ul>
        )}
      </Card>

      <Card tone="magenta" id="events" className="scroll-mt-20">
        <CardTitle>Event champions</CardTitle>
        {hall.eventChampions.length === 0 ? (
          <p className="text-muted">Awarded when an event finishes.</p>
        ) : (
          <ul className="divide-y divide-border">
            {hall.eventChampions.map((e) => (
              <li key={e.id} className="flex items-center justify-between gap-3 py-2">
                <Who p={e.player} />
                <span className="shrink-0 text-right font-mono text-xs text-muted">
                  {e.finale ? "👑" : "⭐"} {e.eventName}
                  {e.finale && " (finale)"}
                  <br />
                  {e.seasonName}
                </span>
              </li>
            ))}
          </ul>
        )}
      </Card>

      <Card id="badges" className="scroll-mt-20">
        <CardTitle>Badges and achievement trophies</CardTitle>
        <p className="mb-3 text-sm text-muted">
          Earned automatically from finished events and never taken away. Rarity counts registered players who
          have played at least one event.
        </p>
        <div className="space-y-6">
          {BADGE_GROUPS.map(({ group, label }) => (
            <section key={group} aria-label={label}>
              <h3 className="mb-2 font-mono text-xs tracking-widest text-magenta uppercase">{label}</h3>
              <ul className="space-y-4">
                {hall.badges
                  .filter((b) => b.group === group)
                  .map((b) => (
                    <li key={b.key}>
                      <p className="font-semibold">
                        <span aria-hidden>{b.icon}</span> {b.label}{" "}
                        <span className="font-mono text-xs font-normal text-muted">
                          held by {b.holders.length} of {b.of} player{b.of === 1 ? "" : "s"}
                        </span>
                      </p>
                      <p className="mb-1 text-sm text-muted">{b.description}</p>
                      {b.holders.length === 0 ? (
                        <p className="text-sm text-muted">Nobody yet.</p>
                      ) : (
                        <Holders label={b.label} holders={b.holders} />
                      )}
                    </li>
                  ))}
              </ul>
            </section>
          ))}
        </div>
      </Card>
    </>
  );
}
