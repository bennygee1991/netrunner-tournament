import Link from "next/link";

const NAV = [
  { href: "/events", label: "Events" },
  { href: "/leaderboards", label: "Boards" },
  { href: "/rules", label: "Rules" },
] as const;

export function SiteHeader() {
  return (
    <header className="sticky top-0 z-40 border-b border-border bg-bg/90 backdrop-blur">
      <div className="mx-auto flex max-w-3xl items-center justify-between gap-3 px-4 py-3">
        <Link href="/" className="font-mono text-sm font-bold tracking-widest uppercase">
          <span className="text-cyan">Net</span>
          <span className="text-magenta">runner</span>
          <span className="text-muted">://circuit</span>
        </Link>
        <nav aria-label="Main">
          <ul className="flex items-center gap-4 font-mono text-sm">
            {NAV.map((item) => (
              <li key={item.href}>
                <Link href={item.href} className="text-muted hover:text-cyan">
                  {item.label}
                </Link>
              </li>
            ))}
          </ul>
        </nav>
      </div>
    </header>
  );
}
