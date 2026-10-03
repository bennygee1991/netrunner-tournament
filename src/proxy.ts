import { NextResponse, type NextRequest } from "next/server";
import { sessionCookieName, sessionCookieOptions } from "@/lib/auth/cookie";

const PROTECTED = ["/account", "/admin"];

/**
 * Runs before every page request:
 *  - fast redirect to /login for protected areas when there is no session cookie (the real
 *    session and role checks happen in each page and server action);
 *  - re-issues the session cookie so its 30-day lifetime slides with use;
 *  - sets a per-request nonce-based Content Security Policy.
 */
export function proxy(request: NextRequest) {
  const cookieName = sessionCookieName();
  const token = request.cookies.get(cookieName)?.value;
  const { pathname, search } = request.nextUrl;

  if (!token && PROTECTED.some((p) => pathname === p || pathname.startsWith(`${p}/`))) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    url.search = `?next=${encodeURIComponent(pathname + search)}`;
    return NextResponse.redirect(url);
  }

  const nonce = Buffer.from(crypto.randomUUID()).toString("base64");
  const isDev = process.env.NODE_ENV === "development";
  const csp = [
    "default-src 'self'",
    `script-src 'self' 'nonce-${nonce}' 'strict-dynamic'${isDev ? " 'unsafe-eval'" : ""}`,
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' blob: data:",
    "font-src 'self'",
    "connect-src 'self'",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "frame-ancestors 'none'",
  ].join("; ");

  const requestHeaders = new Headers(request.headers);
  requestHeaders.set("x-nonce", nonce);
  requestHeaders.set("Content-Security-Policy", csp);
  const response = NextResponse.next({ request: { headers: requestHeaders } });
  response.headers.set("Content-Security-Policy", csp);
  if (token) response.cookies.set(cookieName, token, sessionCookieOptions());
  return response;
}

export const config = {
  matcher: [
    {
      source: "/((?!api|_next/static|_next/image|favicon.ico).*)",
      missing: [
        { type: "header", key: "next-router-prefetch" },
        { type: "header", key: "purpose", value: "prefetch" },
      ],
    },
  ],
};
