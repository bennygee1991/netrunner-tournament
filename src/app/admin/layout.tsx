import Link from "next/link";
import { requireAdmin } from "@/lib/auth/server";

const ADMIN_NAV = [
  { href: "/admin", label: "Dashboard" },
  { href: "/admin/players", label: "Players" },
] as const;

/** Every admin page is behind this server-side role check (plus a check in each action). */
export default async function AdminLayout({ children }: LayoutProps<"/admin">) {
  await requireAdmin();
  return (
    <div>
      <nav
        aria-label="Admin"
        className="mb-4 flex flex-wrap gap-2 border-b border-border pb-3 font-mono text-sm"
      >
        <span className="rounded bg-cyan px-2 py-1 font-bold text-accent-fg uppercase">Admin</span>
        {ADMIN_NAV.map((item) => (
          <Link key={item.href} href={item.href} className="rounded px-2 py-1 text-muted hover:text-cyan">
            {item.label}
          </Link>
        ))}
      </nav>
      {children}
    </div>
  );
}
