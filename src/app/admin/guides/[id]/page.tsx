import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ActionForm } from "@/components/action-form";
import { ConfirmSubmit } from "@/components/confirm-submit";
import { Notice } from "@/components/notice";
import { TypedConfirmForm } from "@/components/typed-confirm";
import { Card, CardTitle, PageTitle, buttonStyles } from "@/components/ui";
import { db } from "@/lib/db";
import { formatDateTime } from "@/lib/format";
import { deleteGuideAction, restoreGuideAction, updateGuideAction } from "../actions";
import { GuideForm } from "../guide-form";

export const metadata: Metadata = { title: "Edit guide" };

export default async function EditGuidePage({ params, searchParams }: PageProps<"/admin/guides/[id]">) {
  const { id } = await params;
  const { notice } = await searchParams;
  const page =
    id.length <= 64
      ? await db.guidePage.findUnique({
          where: { id },
          include: { revisions: { orderBy: { createdAt: "desc" }, take: 30 } },
        })
      : null;
  if (!page) notFound();

  return (
    <>
      <PageTitle kicker="guides">{page.title}</PageTitle>
      <Notice code={notice} />
      <div className="mb-4 flex flex-wrap gap-3 font-mono text-sm">
        <Link href="/admin/guides" className={buttonStyles.link}>
          All pages
        </Link>
        {page.published && (
          <Link href={`/guides/${page.slug}`} className={buttonStyles.link}>
            View page
          </Link>
        )}
      </div>
      <Card>
        <GuideForm action={updateGuideAction} page={page} submitText="Save page" />
      </Card>

      <Card tone="warn">
        <CardTitle>History</CardTitle>
        <p className="mb-3 text-sm text-muted">
          Every saved version. Restoring one saves it as the newest version.
        </p>
        <ol className="divide-y divide-border">
          {page.revisions.map((r, i) => (
            <li key={r.id} className="flex flex-wrap items-center justify-between gap-2 py-2">
              <span className="text-sm">
                <span className="font-mono text-xs text-muted">{formatDateTime(r.createdAt)}</span> ·{" "}
                {r.editorName} · {r.body.length} characters{i === 0 && " · current"}
              </span>
              {i > 0 && (
                <ActionForm
                  action={restoreGuideAction}
                  fields={{ pageId: page.id, revisionId: r.id }}
                  showMessage={false}
                >
                  <ConfirmSubmit variant="secondary">Restore</ConfirmSubmit>
                </ActionForm>
              )}
            </li>
          ))}
        </ol>
      </Card>

      <Card tone="danger">
        <CardTitle>Delete page</CardTitle>
        <TypedConfirmForm
          id="delete-guide"
          action={deleteGuideAction}
          phrase={page.title}
          fields={{ pageId: page.id }}
          label={`Type "${page.title}" to delete this page and its history`}
          buttonText="Delete page"
        />
      </Card>
    </>
  );
}
