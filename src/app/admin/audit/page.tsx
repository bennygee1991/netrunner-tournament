import type { Metadata } from "next";
import Link from "next/link";
import { Card, PageTitle, buttonStyles } from "@/components/ui";
import { db } from "@/lib/db";
import { formatDateTime } from "@/lib/format";

export const metadata: Metadata = { title: "Audit log" };

const PAGE_SIZE = 50;

const LABELS: Record<string, string> = {
  "season.create": "Created season",
  "season.prizes": "Changed prizes",
  "season.archive": "Archived season",
  "system.reset_all": "Reset everything",
  "event.setup": "Edited event setup",
  "event.approve": "Approved sign-up",
  "event.approve_all": "Approved all sign-ups",
  "event.reject_signup": "Rejected sign-up",
  "event.add_player": "Added player",
  "event.add_guest": "Added walk-in",
  "event.remove_entrant": "Removed entrant",
  "event.start_swiss": "Started Swiss",
  "event.pair_round": "Paired round",
  "event.result": "Entered result",
  "event.start_cut": "Started cut",
  "event.finish": "Finished event",
  "event.restart_round": "Restarted round",
  "event.undo_round": "Undid round",
  "event.reopen": "Reopened event",
  "event.reset": "Reset event",
  "event.drop": "Dropped player",
  "event.undrop": "Re-added player",
  "player.temp_password": "Issued temporary password",
  "player.rename": "Renamed player",
  "player.disable": "Disabled account",
  "player.enable": "Enabled account",
  "player.delete": "Deleted account",
  "player.link_guest": "Linked walk-in results",
  "system.backup_download": "Downloaded backup",
};

/** Compact one-line summary of the detail JSON (before/after first). */
function summary(detail: unknown): string {
  if (!detail || typeof detail !== "object") return "";
  const d = { ...(detail as Record<string, unknown>) };
  delete d.eventId;
  delete d.userId;
  delete d.seasonId;
  const parts: string[] = [];
  if ("before" in d || "after" in d) {
    parts.push(`${JSON.stringify(d.before ?? null)} → ${JSON.stringify(d.after ?? null)}`);
    delete d.before;
    delete d.after;
  }
  for (const [k, v] of Object.entries(d))
    parts.push(`${k}: ${typeof v === "string" ? v : JSON.stringify(v)}`);
  return parts.join(" · ");
}

export default async function AuditPage({ searchParams }: PageProps<"/admin/audit">) {
  const sp = await searchParams;
  const page = Math.max(1, Math.min(10_000, Number(sp.page) || 1));
  const filter = typeof sp.q === "string" ? sp.q.trim().slice(0, 40) : "";
  const where = filter
    ? {
        OR: [
          { action: { contains: filter } },
          { actorName: { contains: filter, mode: "insensitive" as const } },
        ],
      }
    : {};
  const [rows, total] = await Promise.all([
    db.auditLog.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
    }),
    db.auditLog.count({ where }),
  ]);
  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const link = (p: number) => `/admin/audit?page=${p}${filter ? `&q=${encodeURIComponent(filter)}` : ""}`;

  return (
    <>
      <PageTitle kicker="organizer">Audit log</PageTitle>
      <form role="search" className="mb-4 flex gap-2">
        <label htmlFor="audit-q" className="sr-only">
          Filter by action or admin
        </label>
        <input
          id="audit-q"
          name="q"
          defaultValue={filter}
          placeholder="Filter: event, player, season, name…"
          className="min-h-11 flex-1 rounded border border-border bg-bg px-3 font-mono"
        />
        <button type="submit" className={buttonStyles.secondary}>
          Filter
        </button>
      </form>
      <p className="mb-2 font-mono text-xs text-muted">
        {total} entr{total === 1 ? "y" : "ies"} · page {page} of {pages}
      </p>
      {rows.length === 0 ? (
        <Card>
          <p className="text-muted">Nothing logged yet.</p>
        </Card>
      ) : (
        <ol className="space-y-2">
          {rows.map((r) => (
            <li key={r.id} className="rounded border border-border bg-surface p-3">
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <span className="font-semibold">{LABELS[r.action] ?? r.action}</span>
                <time dateTime={r.createdAt.toISOString()} className="font-mono text-xs text-muted">
                  {formatDateTime(r.createdAt)}
                </time>
              </div>
              <p className="font-mono text-xs text-cyan">by {r.actorName}</p>
              <p className="mt-1 font-mono text-xs break-words text-muted">{summary(r.detailJson)}</p>
            </li>
          ))}
        </ol>
      )}
      <nav aria-label="Audit pages" className="mt-4 flex justify-between">
        {page > 1 ? (
          <Link href={link(page - 1)} className={buttonStyles.secondary}>
            Newer
          </Link>
        ) : (
          <span />
        )}
        {page < pages && (
          <Link href={link(page + 1)} className={buttonStyles.secondary}>
            Older
          </Link>
        )}
      </nav>
    </>
  );
}
