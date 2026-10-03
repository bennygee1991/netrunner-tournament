import Link from "next/link";
import { logoutAction } from "@/app/(auth)/actions";
import type { SessionUser } from "@/lib/auth/sessions";

const NAV = [
  { href: "/events", label: "Events" },
  { href: "/leaderboards", label: "Boards" },
  { href: "/rules", label: "Rules" },
] as const;

/**
 * Two rows on phones (logo + account, then navigation), one row from the sm breakpoint.
 * Runner names are truncated so long names never push the layout sideways.
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
            <Link
              href="/account"
              className="max-w-[10rem] truncate text-cyan hover:underline"
              title="Your account"
            >
              {user.runnerName}
            </Link>
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
          <ul className="flex items-center gap-x-4 font-mono text-sm">
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
            {user && (
              <li className="ml-auto sm:ml-0">
                <form action={logoutAction}>
                  <button type="submit" className="text-muted hover:text-danger">
                    Log out
                  </button>
                </form>
              </li>
            )}
          </ul>
        </nav>
      </div>
    </header>
  );
}
