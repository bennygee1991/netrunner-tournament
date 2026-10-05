import type { Metadata, Viewport } from "next";
import { SiteHeader } from "@/components/site-header";
import { readPrefs } from "@/lib/auth/accounts";
import { getCurrentUser } from "@/lib/auth/server";
import { THEME_COLOR } from "@/lib/themes";
import "./globals.css";

export const metadata: Metadata = {
  title: { default: "Netrunner Circuit", template: "%s · Netrunner Circuit" },
  description: "Netrunner league: events, Swiss and top-cut brackets, leaderboards.",
};

export async function generateViewport(): Promise<Viewport> {
  // Browser chrome follows the signed-in player's theme; others get dark or light by device.
  const user = await getCurrentUser();
  const theme = user ? readPrefs(user.prefs).theme : "system";
  return {
    width: "device-width",
    initialScale: 1,
    themeColor:
      theme === "system"
        ? [
            { media: "(prefers-color-scheme: dark)", color: THEME_COLOR.dark },
            { media: "(prefers-color-scheme: light)", color: THEME_COLOR.light },
          ]
        : THEME_COLOR[theme],
  };
}

export default async function RootLayout({ children }: LayoutProps<"/">) {
  const user = await getCurrentUser();
  const theme = user ? readPrefs(user.prefs).theme : "system";
  return (
    <html lang="en" className="h-full antialiased" data-theme={theme === "system" ? undefined : theme}>
      <body className="flex min-h-full flex-col">
        <a
          href="#main"
          className="sr-only focus:not-sr-only focus:absolute focus:left-2 focus:top-2 focus:z-50 focus:rounded focus:bg-surface focus:px-3 focus:py-2"
        >
          Skip to content
        </a>
        <SiteHeader user={user} />
        <main id="main" className="mx-auto w-full max-w-3xl flex-1 px-4 py-6">
          {children}
        </main>
        <footer className="border-t border-border px-4 py-4 text-center font-mono text-xs text-muted">
          Netrunner Circuit · fan-run league · not affiliated with Null Signal Games
        </footer>
      </body>
    </html>
  );
}
