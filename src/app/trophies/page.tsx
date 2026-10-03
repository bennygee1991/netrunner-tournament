import type { Metadata } from "next";
import Link from "next/link";
import { Avatar } from "@/components/avatar";
import { Card, CardTitle, PageTitle } from "@/components/ui";
import { db } from "@/lib/db";
import { formatDate } from "@/lib/format";
import { type HallPlayer, getHallOfChampions } from "@/lib/tournament/community";
import { TROPHY_INFO } from "@/lib/tournament/profiles";

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

export default async function TrophiesPage() {
  const hall = await getHallOfChampions(db);
  return (
    <>
      <PageTitle kicker="trophy cabinet">Hall of champions</PageTitle>
      <nav aria-label="Sections" className="mb-4 flex flex-wrap gap-2 font-mono text-xs">
        {[
          ["#seasons", "Season champions"],
          ["#events", "Event champions"],
          ["#milestones", "Milestones"],
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
                      <span className="w-8 text-center text-2xl" aria-label={TROPHY_INFO[pl.kind]?.label}>
                        {TROPHY_INFO[pl.kind]?.icon}
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
                  ⭐ {e.eventName}
                  <br />
                  {e.seasonName}
                </span>
              </li>
            ))}
          </ul>
        )}
      </Card>

      <Card id="milestones" className="scroll-mt-20">
        <CardTitle>Milestones</CardTitle>
        <div className="space-y-4">
          {hall.milestones.map((m) => (
            <section key={m.key}>
              <h3 className="font-semibold">
                <span aria-hidden>{TROPHY_INFO[m.key]?.icon}</span> {m.label}{" "}
                <span className="font-mono text-xs text-muted">({m.holders.length})</span>
              </h3>
              <p className="mb-2 text-sm text-muted">{m.description}</p>
              {m.holders.length === 0 ? (
                <p className="text-sm text-muted">Nobody yet.</p>
              ) : (
                <ul className="flex flex-wrap gap-3" aria-label={`${m.label} holders`}>
                  {m.holders.map((h) => (
                    <li key={h.seed}>
                      <Who p={h} size={28} />
                    </li>
                  ))}
                </ul>
              )}
            </section>
          ))}
        </div>
      </Card>
    </>
  );
}
