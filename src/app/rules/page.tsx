import type { Metadata } from "next";
import Link from "next/link";
import { Card, CardTitle, PageTitle } from "@/components/ui";
import { NSG_POLICIES_URL, rulesContent } from "@/lib/rules-content";

export const metadata: Metadata = { title: "Rules" };

export default function RulesPage() {
  const sections = rulesContent();
  return (
    <>
      <PageTitle kicker="how it works">Rules</PageTitle>
      <nav aria-label="Rules sections" className="mb-4 flex flex-wrap gap-2 font-mono text-xs">
        {sections.map((s) => (
          <a
            key={s.id}
            href={`#${s.id}`}
            className="rounded border border-border px-2 py-1 hover:border-cyan"
          >
            {s.title}
          </a>
        ))}
      </nav>
      {sections.map((s) => (
        <Card key={s.id} id={s.id} tone={s.tone} className="scroll-mt-20">
          <CardTitle>{s.title}</CardTitle>
          {s.blocks.map((b, i) => (
            <div key={i} className="mb-3 last:mb-0">
              {b.heading && (
                <h3 className="mb-1 font-mono text-sm tracking-widest text-muted uppercase">{b.heading}</h3>
              )}
              <ul className="list-disc space-y-1 pl-5">
                {b.items.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            </div>
          ))}
        </Card>
      ))}
      <p className="mb-3 text-sm">
        New to the game, or looking for venue info and house rules? See the{" "}
        <Link href="/guides" className="text-cyan underline">
          Guides
        </Link>
        .
      </p>
      <p className="text-xs text-muted">
        Based on the Null Signal Games Organized Play Policies v1.6.2 and the original FFG Android: Netrunner
        tournament rules.{" "}
        <a href={NSG_POLICIES_URL} className="text-cyan underline" rel="noopener noreferrer" target="_blank">
          NSG policies (PDF)
        </a>
      </p>
    </>
  );
}
