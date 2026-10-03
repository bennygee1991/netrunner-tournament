import "server-only";
import { cookies, headers } from "next/headers";
import { notFound, redirect } from "next/navigation";
import { cache } from "react";
import { db } from "../db";
import { sessionCookieName, sessionCookieOptions } from "./cookie";
import { type SessionUser, validateSession } from "./sessions";

export { safeNext } from "./redirect";

export async function readSessionToken(): Promise<string | undefined> {
  return (await cookies()).get(sessionCookieName())?.value;
}

export async function setSessionCookie(token: string) {
  (await cookies()).set(sessionCookieName(), token, sessionCookieOptions());
}

export async function clearSessionCookie() {
  (await cookies()).delete(sessionCookieName());
}

/** Current signed-in user for this request (memoised per request), or null. */
export const getCurrentUser = cache(async (): Promise<SessionUser | null> => {
  const token = await readSessionToken();
  if (!token) return null;
  return validateSession(db, token);
});

/** Paths a user with a temporary password may still visit. */
const FORCED_CHANGE_PATH = "/account/password";

/** Requires a signed-in user; sends users with a temporary password to the change-password page. */
export async function requireUser(opts: { allowForcedChange?: boolean } = {}): Promise<SessionUser> {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (user.mustChangePassword && !opts.allowForcedChange) redirect(FORCED_CHANGE_PATH);
  return user;
}

/** Requires an admin. Non-admins get a 404 so the admin area is not advertised. */
export async function requireAdmin(): Promise<SessionUser> {
  const user = await requireUser();
  if (user.role !== "ADMIN") notFound();
  return user;
}

/** Best-effort client IP for rate limiting (Vercel sets x-real-ip / x-forwarded-for). */
export async function clientIp(): Promise<string> {
  const h = await headers();
  const real = h.get("x-real-ip");
  if (real) return real.trim();
  const fwd = h.get("x-forwarded-for");
  if (fwd) return fwd.split(",")[0]!.trim();
  return "unknown";
}

/**
 * CSRF defence in depth for server actions: Next.js already rejects actions whose Origin does not
 * match the Host, and the session cookie is SameSite=Lax. This additionally pins Origin to APP_URL.
 */
export async function assertSameOrigin() {
  const origin = (await headers()).get("origin");
  if (!origin || !allowedOrigins().includes(origin)) {
    throw new Error("Cross-site request blocked.");
  }
}

function allowedOrigins(): string[] {
  const list: string[] = [];
  if (process.env.APP_URL) list.push(new URL(process.env.APP_URL).origin);
  // Vercel's own hosts: the production domain, this deployment, and the branch preview.
  for (const v of ["VERCEL_PROJECT_PRODUCTION_URL", "VERCEL_URL", "VERCEL_BRANCH_URL"]) {
    const host = process.env[v];
    if (host) list.push(`https://${host}`);
  }
  return list;
}
