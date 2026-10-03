import { SESSION_TTL_MS } from "./tokens";

/** Secure cookies need HTTPS (always the case on Vercel); local http dev/e2e uses the plain name. */
export function isSecureDeployment(): boolean {
  return process.env.VERCEL === "1" || (process.env.APP_URL ?? "").startsWith("https://");
}

/** `__Host-` prefix pins the cookie to this exact host, HTTPS only, path=/. */
export function sessionCookieName(): string {
  return isSecureDeployment() ? "__Host-nc_session" : "nc_session";
}

export function sessionCookieOptions() {
  return {
    httpOnly: true,
    secure: isSecureDeployment(),
    sameSite: "lax" as const,
    path: "/",
    maxAge: Math.floor(SESSION_TTL_MS / 1000),
  };
}
