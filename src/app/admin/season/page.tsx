import type { Metadata } from "next";
import Link from "next/link";
import { Notice } from "@/components/notice";
import { Card, CardTitle, PageTitle } from "@/components/ui";
import { EventStatusBadge, formatLine } from "@/components/tournament/status-badge";
import { db } from "@/lib/db";
import { formatDay, todayIso } from "@/lib/tournament/dates";
import { getActiveSeason } from "@/lib/tournament/queries";
import { leagueFormat } from "@/lib/tournament/season";
import { ArchiveSeasonCard, ResetAllCard } from "./danger-zone";
import { CreateSeasonForm, PrizesForm } from "./season-forms";

export const metadata: Metadata = { title: "Season" };

export default async function AdminSeasonPage({ searchParams }: PageProps<"/admin/season">) {
  const { notice } = await searchParams;
  const season = await getActiveSeason(db);
  if (!season) {
    const past = await db.season.count();
    return (
      <>
        <PageTitle kicker="organizer">Season</PageTitle>
        <Notice code={notice} />
        <Card tone="magenta">
          <CardTitle>Start a season</CardTitle>
          <CreateSeasonForm
            defaultName={`Season ${past + 1}`}
            defaultDate={todayIso()}
            formats={[false, false, false, true].map((finale) => leagueFormat(finale))}
          />
        </Card>
        <ResetAllCard />
      </>
    );
  }
  return (
    <>
      <PageTitle kicker="organizer">{season.name}</PageTitle>
      <Notice code={notice} />
      <Card>
        <CardTitle>Events</CardTitle>
        <ul className="divide-y divide-border">
          {season.events.map((e) => (
            <li key={e.id}>
              <Link href={`/admin/events/${e.id}`} className="flex items-center gap-3 py-3 hover:text-cyan">
                <div className="min-w-0 flex-1">
                  <p className="text-lg font-semibold">{e.name}</p>
                  <p className="font-mono text-xs text-muted">
                    {formatDay(e.date)} · Month {e.month} ·{" "}
                    {formatLine(e.matchFormat, e.cutSize, e.finale, e.cutFormat)}
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
      </Card>
      <Card tone="warn">
        <CardTitle>Prizes</CardTitle>
        <p className="mb-3 text-sm text-muted">Shown publicly on the leaderboards.</p>
        <PrizesForm seasonId={season.id} prizes={season.prizes} />
      </Card>
      <ArchiveSeasonCard
        seasonId={season.id}
        seasonName={season.name}
        unfinished={season.events.filter((e) => e.status !== "DONE").length}
      />
      <ResetAllCard />
    </>
  );
}
