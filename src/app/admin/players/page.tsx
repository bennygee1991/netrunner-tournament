import type { Metadata } from "next";
import { Badge, Card, FormMessage, PageTitle, buttonStyles } from "@/components/ui";
import { requireAdmin } from "@/lib/auth/server";
import { db } from "@/lib/db";
import { formatDate } from "@/lib/format";
import { PlayerActions } from "./player-actions";

export const metadata: Metadata = { title: "Players" };

export default async function AdminPlayersPage({ searchParams }: PageProps<"/admin/players">) {
  const admin = await requireAdmin();
  const sp = await searchParams;
  const raw = sp.q;
  const q = typeof raw === "string" ? raw.trim().toLowerCase().slice(0, 50) : "";
  const players = await db.user.findMany({
    where: q ? { runnerNameLower: { contains: q } } : undefined,
    orderBy: { runnerNameLower: "asc" },
    take: 200,
    select: {
      id: true,
      runnerName: true,
      email: true,
      role: true,
      disabledAt: true,
      mustChangePassword: true,
      createdAt: true,
    },
  });

  const guestNames = [
    ...new Set([
      ...(
        await db.entrant.findMany({
          where: { userId: null, guestName: { not: null } },
          select: { guestName: true },
        })
      ).map((e) => e.guestName!),
      ...(await db.eventRecord.findMany({ where: { userId: null }, select: { playerName: true } })).map(
        (r) => r.playerName,
      ),
    ]),
  ]
    .filter((n) => !n.startsWith("Deleted player "))
    .sort((a, b) => a.localeCompare(b));

  return (
    <>
      <PageTitle kicker="organizer">Players</PageTitle>
      <form role="search" className="mb-4 flex gap-2">
        <label htmlFor="q" className="sr-only">
          Search runner names
        </label>
        <input
          id="q"
          name="q"
          defaultValue={q}
          placeholder="Search runner names"
          className="min-h-11 flex-1 rounded border border-border bg-bg px-3 font-mono"
        />
        <button type="submit" className={buttonStyles.secondary}>
          Search
        </button>
      </form>
      {sp.renamed && <FormMessage tone="ok">Renamed.</FormMessage>}
      {players.length === 0 && <p className="text-muted">No players found.</p>}
      {guestNames.length > 0 && !q && (
        <Card tone="warn">
          <h2 className="mb-2 font-mono text-xs tracking-widest text-muted uppercase">
            Walk-in players (no account)
          </h2>
          <ul className="flex flex-wrap gap-2">
            {guestNames.map((n) => (
              <li key={n} className="rounded border border-border px-2 py-1 text-sm">
                {n}
              </li>
            ))}
          </ul>
          <p className="mt-2 text-xs text-muted">
            When a walk-in creates an account, open their account below and use &quot;Link walk-in
            results&quot;.
          </p>
        </Card>
      )}
      <ul>
        {players.map((p) => (
          <li key={p.id}>
            <Card tone={p.disabledAt ? "danger" : "cyan"}>
              <details>
                <summary className="flex cursor-pointer list-none flex-wrap items-center gap-2">
                  <span className="text-lg font-semibold">{p.runnerName}</span>
                  {p.role === "ADMIN" && <Badge tone="cyan">Admin</Badge>}
                  {p.disabledAt && <Badge tone="danger">Disabled</Badge>}
                  {p.mustChangePassword && <Badge>Temp password</Badge>}
                  <span className="ml-auto font-mono text-xs text-muted">
                    joined {formatDate(p.createdAt)}
                  </span>
                </summary>
                {p.email && <p className="mt-2 font-mono text-sm text-muted">{p.email}</p>}
                <PlayerActions
                  player={{
                    id: p.id,
                    runnerName: p.runnerName,
                    disabled: !!p.disabledAt,
                    isSelf: p.id === admin.id,
                  }}
                />
              </details>
            </Card>
          </li>
        ))}
      </ul>
    </>
  );
}
