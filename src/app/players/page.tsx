import type { Metadata } from "next";
import Link from "next/link";
import { Avatar } from "@/components/avatar";
import { Badge, PageTitle, buttonStyles, cx } from "@/components/ui";
import { db } from "@/lib/db";
import { getPlayerDirectory } from "@/lib/tournament/community";

export const metadata: Metadata = { title: "Players" };

const SORTS = [
  { key: "name", label: "A-Z" },
  { key: "events", label: "Most events" },
  { key: "trophies", label: "Most trophies" },
] as const;
type Sort = (typeof SORTS)[number]["key"];

export default async function PlayersPage({ searchParams }: PageProps<"/players">) {
  const sp = await searchParams;
  const q = typeof sp.q === "string" ? sp.q.slice(0, 50) : "";
  const sort: Sort = SORTS.some((s) => s.key === sp.sort) ? (sp.sort as Sort) : "name";
  const players = await getPlayerDirectory(db, { q, sort });
  const link = (s: Sort) => `/players?sort=${s}${q ? `&q=${encodeURIComponent(q)}` : ""}`;

  return (
    <>
      <PageTitle kicker="the circuit">Players</PageTitle>
      <form role="search" className="mb-3 flex gap-2">
        <label htmlFor="players-q" className="sr-only">
          Search runner names
        </label>
        <input
          id="players-q"
          name="q"
          defaultValue={q}
          placeholder="Search runner names"
          className="min-h-11 flex-1 rounded border border-border bg-bg px-3 font-mono"
        />
        <input type="hidden" name="sort" value={sort} />
        <button type="submit" className={buttonStyles.secondary}>
          Search
        </button>
      </form>
      <nav aria-label="Sort players" className="mb-4 flex flex-wrap gap-2 font-mono text-xs">
        {SORTS.map((s) => (
          <Link
            key={s.key}
            href={link(s.key)}
            aria-current={sort === s.key ? "page" : undefined}
            className={cx(
              "rounded border px-2 py-1",
              sort === s.key ? "border-cyan bg-cyan text-accent-fg" : "border-border hover:border-cyan",
            )}
          >
            {s.label}
          </Link>
        ))}
      </nav>
      <p className="mb-2 font-mono text-xs text-muted">
        {players.length} player{players.length === 1 ? "" : "s"}
      </p>
      {players.length === 0 ? (
        <p className="py-6 text-center text-muted">No players found.</p>
      ) : (
        <ul className="grid grid-cols-1 gap-2 sm:grid-cols-2" aria-label="Players">
          {players.map((p) => (
            <li key={p.id}>
              <Link
                href={`/players/${encodeURIComponent(p.runnerName)}`}
                className="flex items-center gap-3 rounded border border-border bg-surface p-3 hover:border-cyan"
              >
                <Avatar avatar={p.avatar} seed={p.id} size={48} />
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-semibold">
                    {p.runnerName} {p.organizer && <Badge tone="cyan">Organizer</Badge>}
                  </span>
                  <span className="block font-mono text-xs text-muted">
                    {p.events} event{p.events === 1 ? "" : "s"} · {p.trophies} troph
                    {p.trophies === 1 ? "y" : "ies"}
                    {p.titles > 0 && ` · ${p.titles} win${p.titles === 1 ? "" : "s"}`}
                  </span>
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
