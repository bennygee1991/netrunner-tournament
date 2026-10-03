import type { Metadata } from "next";
import Link from "next/link";
import { Card, PageTitle } from "@/components/ui";
import { db } from "@/lib/db";
import { formatDate } from "@/lib/format";
import { listPublishedGuides } from "@/lib/guides";

export const metadata: Metadata = { title: "Guides" };

export default async function GuidesPage() {
  const pages = await listPublishedGuides(db);
  return (
    <>
      <PageTitle kicker="learn">Guides</PageTitle>
      <p className="mb-4 text-muted">
        How to play, house rules, venue info and FAQs from the organizers. The league format itself (pairings,
        scoring, points) is on the{" "}
        <Link href="/rules" className="text-cyan underline">
          Rules page
        </Link>
        .
      </p>
      {pages.length === 0 ? (
        <Card>
          <p className="py-4 text-center text-muted">No guides yet. Check back soon.</p>
        </Card>
      ) : (
        <ul>
          {pages.map((p) => (
            <li key={p.slug}>
              <Card>
                <Link href={`/guides/${p.slug}`} className="block hover:text-cyan">
                  <span className="block text-lg font-bold">{p.title}</span>
                  <span className="font-mono text-xs text-muted">Updated {formatDate(p.updatedAt)}</span>
                </Link>
              </Card>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
