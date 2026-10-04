import Link from "next/link";
import { logoutAction } from "@/app/(auth)/actions";
import type { SessionUser } from "@/lib/auth/sessions";

const NAV = [
  { href: "/events", label: "Events" },
  { href: "/leaderboards", label: "Boards" },
  { href: "/players", label: "Players" },
  { href: "/rules", label: "Rules" },
  { href: "/guides", label: "Guides" },
] as const;

/**
 * Row 1: logo, then account (name + log out) or log in / register.
 * Row 2 on phones (inline from sm): the section links.
 */
export function SiteHeader({ user }: { user: SessionUser | null }) {
  return (
    <header className="sticky top-0 z-40 border-b border-border bg-bg/90 backdrop-blur">
      <div className="mx-auto flex max-w-3xl flex-wrap items-center gap-x-4 gap-y-2 px-4 py-3">
        <Link href="/" className="font-mono text-sm font-bold tracking-widest uppercase">
          <span className="text-cyan">Net</span>
          <span className="text-magenta">runner</span>
          <span className="text-muted">://circuit</span>
        </Link>

        <div className="ml-auto flex min-w-0 items-center gap-3 font-mono text-sm sm:order-last">
          {user ? (
            <>
              <Link
                href="/account"
                className="max-w-[9rem] truncate text-cyan hover:underline"
                title="Your account"
              >
                {user.runnerName}
              </Link>
              <form action={logoutAction}>
                <button type="submit" className="text-muted hover:text-danger">
                  Log out
                </button>
              </form>
            </>
          ) : (
            <>
              <Link href="/login" className="text-cyan hover:underline">
                Log in
              </Link>
              <Link href="/register" className="rounded border border-magenta px-2 py-1 text-magenta">
                Register
              </Link>
            </>
          )}
        </div>

        <nav aria-label="Main" className="w-full sm:w-auto">
          <ul className="flex flex-wrap items-center gap-x-4 gap-y-1 font-mono text-sm">
            {NAV.map((item) => (
              <li key={item.href}>
                <Link href={item.href} className="text-muted hover:text-cyan">
                  {item.label}
                </Link>
              </li>
            ))}
            {user?.role === "ADMIN" && (
              <li>
                <Link href="/admin" className="text-magenta hover:text-cyan">
                  Admin
                </Link>
              </li>
            )}
          </ul>
        </nav>
      </div>
    </header>
  );
}
