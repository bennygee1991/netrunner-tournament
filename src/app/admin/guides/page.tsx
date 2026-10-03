import type { Metadata } from "next";
import Link from "next/link";
import { ActionForm } from "@/components/action-form";
import { Notice } from "@/components/notice";
import { SubmitButton } from "@/components/submit-button";
import { Badge, Card, CardTitle, PageTitle, buttonStyles } from "@/components/ui";
import { db } from "@/lib/db";
import { formatDate } from "@/lib/format";
import { addStarterGuidesAction } from "./actions";

export const metadata: Metadata = { title: "Guides" };

export default async function AdminGuidesPage({ searchParams }: PageProps<"/admin/guides">) {
  const { notice } = await searchParams;
  const pages = await db.guidePage.findMany({ orderBy: [{ sortOrder: "asc" }, { title: "asc" }] });
  return (
    <>
      <PageTitle kicker="organizer">Guides</PageTitle>
      <Notice code={notice} />
      <div className="mb-4 flex flex-wrap gap-3">
        <Link href="/admin/guides/new" className={buttonStyles.primary}>
          New page
        </Link>
        <Link href="/guides" className={buttonStyles.secondary}>
          View public guides
        </Link>
      </div>
      {pages.length === 0 ? (
        <Card tone="magenta">
          <CardTitle>Get started</CardTitle>
          <p className="mb-3 text-sm text-muted">
            Add four draft pages (How to play, League and tournament rules, Venue, FAQ) with headings and
            links to the official rules for you to fill in. Drafts stay hidden until you publish them.
          </p>
          <ActionForm action={addStarterGuidesAction}>
            <SubmitButton variant="secondary" pendingText="Adding…">
              Add starter pages
            </SubmitButton>
          </ActionForm>
        </Card>
      ) : (
        <ul>
          {pages.map((p) => (
            <li key={p.id}>
              <Card tone={p.published ? "cyan" : "warn"}>
                <Link
                  href={`/admin/guides/${p.id}`}
                  className="flex flex-wrap items-center gap-2 hover:text-cyan"
                >
                  <span className="text-lg font-semibold">{p.title}</span>
                  {p.published ? <Badge tone="cyan">Published</Badge> : <Badge>Draft</Badge>}
                  <span className="ml-auto font-mono text-xs text-muted">
                    /guides/{p.slug} · updated {formatDate(p.updatedAt)}
                  </span>
                </Link>
              </Card>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
