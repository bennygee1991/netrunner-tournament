import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { MarkdownView } from "@/components/markdown";
import { Card, PageTitle, buttonStyles } from "@/components/ui";
import { getCurrentUser } from "@/lib/auth/server";
import { db } from "@/lib/db";
import { formatDate } from "@/lib/format";
import { getPublishedGuide } from "@/lib/guides";

export async function generateMetadata({ params }: PageProps<"/guides/[slug]">): Promise<Metadata> {
  const page = await getPublishedGuide(db, (await params).slug);
  return { title: page?.title ?? "Guide" };
}

export default async function GuidePage({ params }: PageProps<"/guides/[slug]">) {
  const [page, user] = await Promise.all([getPublishedGuide(db, (await params).slug), getCurrentUser()]);
  if (!page) notFound();
  return (
    <>
      <PageTitle kicker="guide">{page.title}</PageTitle>
      <div className="mb-4 flex flex-wrap items-center gap-3 font-mono text-xs text-muted">
        <span>Updated {formatDate(page.updatedAt)}</span>
        <Link href="/guides" className={buttonStyles.link}>
          All guides
        </Link>
        {user?.role === "ADMIN" && (
          <Link href={`/admin/guides/${page.id}`} className={buttonStyles.link}>
            Edit this page
          </Link>
        )}
      </div>
      <Card>
        <MarkdownView source={page.body} />
      </Card>
    </>
  );
}
