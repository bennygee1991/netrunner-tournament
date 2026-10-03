import type { Metadata } from "next";
import Link from "next/link";
import { Avatar } from "@/components/avatar";
import { PlayerLink } from "@/components/player-link";
import { Card, CardTitle, PageTitle, cx } from "@/components/ui";
import { EVENT_POINTS } from "@/engine";
import { db } from "@/lib/db";
import { formatDay } from "@/lib/tournament/dates";
import { type BoardView, getLiveBoards, getPastSeasons } from "@/lib/tournament/leaderboards";

export const metadata: Metadata = { title: "Leaderboards" };

const TABS = [
  { key: "month1", label: "Month 1" },
  { key: "month2", label: "Month 2" },
  { key: "season", label: "Season" },
  { key: "past", label: "Past" },
] as const;
type Tab = (typeof TABS)[number]["key"];

function Prize({ label, text }: { label: string; text: string }) {
  if (!text) return null;
  return (
    <div className="my-3 rounded border border-dashed border-warn p-3">
      <p className="font-mono text-xs tracking-widest text-warn uppercase">{label} prize</p>
      <p>{text}</p>
    </div>
  );
}

function Podium({ board }: { board: BoardView }) {
  const top = board.rows.slice(0, 3);
  if (!top.length) return null;
  return (
    <ol className="my-3 grid grid-cols-3 gap-2" aria-label="Top 3">
      {top.map((r, i) => (
        <li
          key={r.key}
          className={cx(
            "min-w-0 rounded border bg-surface p-2 text-center",
            i === 0 ? "border-warn" : "border-border",
          )}
        >
          <p className={cx("font-mono text-xs", i === 0 ? "text-warn" : "text-muted")}>#{r.rank}</p>
          <Avatar avatar={r.avatar} seed={r.key.replace(/^u:/, "")} size={40} className="mx-auto my-1" />
          <p className="truncate font-bold">
            <PlayerLink name={r.name} profile={r.profile} />
          </p>
          <p className="font-mono text-lg text-cyan">{r.total}</p>
        </li>
      ))}
    </ol>
  );
}

function BoardTable({ board }: { board: BoardView }) {
  if (!board.rows.length) {
    return (
      <p className="py-6 text-center text-muted">No results yet. Points appear when an event finishes.</p>
    );
  }
  return (
    <div
      className="overflow-x-auto"
      tabIndex={0}
      role="region"
      aria-label={`${board.title} leaderboard (scrolls sideways)`}
    >
      <table className="w-full border-collapse font-mono text-sm">
        <caption className="sr-only">{board.title} leaderboard</caption>
        <thead>
          <tr className="border-b border-border text-[11px] tracking-widest text-muted uppercase">
            <th scope="col" className="p-2 text-left">
              #
            </th>
            <th scope="col" className="p-2 text-left">
              Player
            </th>
            {board.columns.map((c) => (
              <th key={c.id} scope="col" className="p-2 text-right">
                {c.label}
              </th>
            ))}
            <th scope="col" className="p-2 text-right">
              Total
            </th>
            <th scope="col" className="p-2 text-right">
              <span aria-hidden>🏆</span>
              <span className="sr-only">Event wins</span>
            </th>
          </tr>
        </thead>
        <tbody>
          {board.rows.map((r) => (
            <tr key={r.key} className="border-b border-border">
              <td className="p-2 text-muted">{r.rank}</td>
              <td className="p-2 font-sans text-base font-semibold">
                <PlayerLink name={r.name} profile={r.profile} />
              </td>
              {r.cells.map((c, i) => (
                <td key={i} className="p-2 text-right">
                  {c ?? "–"}
                </td>
              ))}
              <td className="p-2 text-right font-bold text-cyan">{r.total}</td>
              <td className="p-2 text-right">{r.titles || ""}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

async function PastSeasons() {
  const seasons = await getPastSeasons(db);
  if (!seasons.length) {
    return (
      <Card tone="warn">
        <CardTitle>Hall of fame</CardTitle>
        <p className="py-4 text-center text-muted">Past seasons show up here after the first season ends.</p>
      </Card>
    );
  }
  return (
    <>
      {seasons.map((s) => {
        const winner = (key: "month1" | "month2" | "season") => {
          const rows = s.boards[key]?.rows ?? [];
          const top = rows.filter((r) => r.rank === 1);
          return top.length ? top.map((r) => `${r.name} (${r.total} pts)`).join(", ") : "—";
        };
        return (
          <Card key={s.id} tone="warn">
            <CardTitle>{s.name}</CardTitle>
            <p className="mb-3 font-mono text-xs text-muted">
              {formatDay(s.startDate)}
              {s.archivedAt && ` → ${formatDay(s.archivedAt)}`}
            </p>
            <dl className="mb-3 space-y-1">
              <div>
                <dt className="inline font-mono text-xs text-warn uppercase">Season champion: </dt>
                <dd className="inline font-bold">{winner("season")}</dd>
              </div>
              <div>
                <dt className="inline font-mono text-xs text-muted uppercase">Month 1: </dt>
                <dd className="inline">{winner("month1")}</dd>
              </div>
              <div>
                <dt className="inline font-mono text-xs text-muted uppercase">Month 2: </dt>
                <dd className="inline">{winner("month2")}</dd>
              </div>
            </dl>
            {(["season", "month1", "month2"] as const).map((key) => {
              const b = s.boards[key];
              if (!b) return null;
              return (
                <details key={key} className="border-t border-border py-2">
                  <summary className="cursor-pointer font-mono text-sm tracking-widest text-muted uppercase">
                    {key === "season" ? "Season" : key === "month1" ? "Month 1" : "Month 2"} board
                    {b.prize && ` · prize: ${b.prize}`}
                  </summary>
                  <ol className="mt-2 space-y-1 font-mono text-sm">
                    {b.rows.map((r) => (
                      <li key={r.key} className="flex justify-between gap-2">
                        <span>
                          <span className="text-muted">{r.rank}.</span>{" "}
                          <PlayerLink name={r.name} profile={r.profile} />
                        </span>
                        <span className="text-cyan">{r.total}</span>
                      </li>
                    ))}
                  </ol>
                </details>
              );
            })}
          </Card>
        );
      })}
    </>
  );
}

export default async function LeaderboardsPage({ searchParams }: PageProps<"/leaderboards">) {
  const raw = (await searchParams).board;
  const tab: Tab = TABS.some((t) => t.key === raw) ? (raw as Tab) : "month1";
  const live = tab === "past" ? null : await getLiveBoards(db);

  return (
    <>
      <PageTitle kicker={live?.season.name ?? "league"}>Leaderboards</PageTitle>
      <p className="-mt-3 mb-4 text-sm">
        <Link href="/trophies" className="text-cyan underline">
          Hall of champions
        </Link>{" "}
        · every trophy ever won
      </p>
      <nav aria-label="Boards" className="mb-4 grid grid-cols-4 gap-2">
        {TABS.map((t) => (
          <Link
            key={t.key}
            href={`/leaderboards?board=${t.key}`}
            aria-current={tab === t.key ? "page" : undefined}
            className={cx(
              "flex min-h-11 items-center justify-center rounded border font-mono text-sm font-bold uppercase",
              tab === t.key ? "border-cyan bg-cyan text-accent-fg" : "border-border hover:border-cyan",
            )}
          >
            {t.label}
          </Link>
        ))}
      </nav>
      {tab === "past" ? (
        <PastSeasons />
      ) : !live ? (
        <Card>
          <p className="py-6 text-center text-muted">Leaderboards start once a season is created.</p>
        </Card>
      ) : (
        <Card tone="magenta">
          <CardTitle>{live.boards[tab].title} leaderboard</CardTitle>
          <p className="font-mono text-xs text-muted">
            {live.boards[tab].eventsDone} of {live.boards[tab].eventsTotal} events complete · 1st{" "}
            {EVENT_POINTS.champion} · 2nd {EVENT_POINTS.finalist} · top 4 {EVENT_POINTS.top4} · top 8{" "}
            {EVENT_POINTS.top8} · played {EVENT_POINTS.played}
          </p>
          <Podium board={live.boards[tab]} />
          <Prize label={live.boards[tab].title} text={live.boards[tab].prize} />
          <BoardTable board={live.boards[tab]} />
        </Card>
      )}
    </>
  );
}
