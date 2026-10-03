import type { PrismaClient } from "@/generated/prisma/client";
import { SESSION_REFRESH_MS, SESSION_TTL_MS, hashToken, newSessionToken } from "./tokens";

export type SessionUser = {
  id: string;
  runnerName: string;
  role: "PLAYER" | "ADMIN";
  mustChangePassword: boolean;
  prefs: unknown;
};

export async function createSession(db: PrismaClient, userId: string): Promise<string> {
  const token = newSessionToken();
  await db.session.create({
    data: { id: hashToken(token), userId, expiresAt: new Date(Date.now() + SESSION_TTL_MS) },
  });
  return token;
}

/** Resolves a cookie token to its user, sliding the expiry. Returns null if invalid/expired/disabled. */
export async function validateSession(db: PrismaClient, token: string): Promise<SessionUser | null> {
  if (!token || token.length > 100) return null;
  const id = hashToken(token);
  const session = await db.session.findUnique({
    where: { id },
    include: {
      user: {
        select: {
          id: true,
          runnerName: true,
          role: true,
          mustChangePassword: true,
          prefs: true,
          disabledAt: true,
        },
      },
    },
  });
  if (!session) return null;
  const now = Date.now();
  if (session.expiresAt.getTime() <= now || session.user.disabledAt) {
    await db.session.deleteMany({ where: { id } });
    return null;
  }
  if (now - session.lastSeenAt.getTime() > SESSION_REFRESH_MS) {
    await db.session.update({
      where: { id },
      data: { lastSeenAt: new Date(now), expiresAt: new Date(now + SESSION_TTL_MS) },
    });
  }
  const { id: userId, runnerName, role, mustChangePassword, prefs } = session.user;
  return { id: userId, runnerName, role, mustChangePassword, prefs };
}

export async function deleteSession(db: PrismaClient, token: string): Promise<void> {
  await db.session.deleteMany({ where: { id: hashToken(token) } });
}

/** Logs a user out everywhere, optionally keeping one session (the current one). */
export async function deleteUserSessions(db: PrismaClient, userId: string, keepToken?: string) {
  await db.session.deleteMany({
    where: { userId, ...(keepToken ? { id: { not: hashToken(keepToken) } } : {}) },
  });
}
