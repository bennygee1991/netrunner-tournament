import { z } from "zod";
import type { Prisma, PrismaClient } from "@/generated/prisma/client";
import { audit, type Actor } from "../audit";
import { isAvatarKey } from "../avatars";
import { getDummyHash, hashPassword, verifyPassword } from "../password";
import { LIMITS, clear, consume, peek, sweepExpired } from "../rate-limit";
import { passwordProblem, runnerNameKey, runnerNameSchema } from "../validation";
import { createSession, deleteUserSessions } from "./sessions";
import { newTempPassword } from "./tokens";
import { THEME_VALUES } from "../themes";

export type FieldErrors = Partial<Record<string, string>>;
export type Fail = { ok: false; error?: string; fieldErrors?: FieldErrors };

export const GENERIC_LOGIN_ERROR = "Runner name or password is incorrect.";

const optionalEmail = z
  .string()
  .trim()
  .max(254)
  .transform((v) => (v === "" ? null : v.toLowerCase()))
  .pipe(z.email("Enter a valid email address or leave it empty.").nullable());

function tooMany(retryAfterSec: number): Fail {
  const minutes = Math.ceil(retryAfterSec / 60);
  return {
    ok: false,
    error: `Too many attempts. Try again in ${minutes} minute${minutes === 1 ? "" : "s"}.`,
  };
}

function firstErrors(error: z.ZodError): FieldErrors {
  const out: FieldErrors = {};
  for (const issue of error.issues) {
    const key = String(issue.path[0] ?? "form");
    out[key] ??= issue.message;
  }
  return out;
}

// ---------------------------------------------------------------- register

export const registerInput = z
  .object({
    runnerName: runnerNameSchema,
    password: z.string().max(1000),
    confirm: z.string().max(1000),
    email: optionalEmail,
  })
  .superRefine((v, ctx) => {
    const problem = passwordProblem(v.password, v.runnerName);
    if (problem) ctx.addIssue({ code: "custom", path: ["password"], message: problem });
    else if (v.password !== v.confirm) {
      ctx.addIssue({ code: "custom", path: ["confirm"], message: "Passwords do not match." });
    }
  });

export async function registerUser(
  db: PrismaClient,
  raw: unknown,
  ip: string,
): Promise<{ ok: true; token: string; userId: string } | Fail> {
  const parsed = registerInput.safeParse(raw);
  if (!parsed.success) return { ok: false, fieldErrors: firstErrors(parsed.error) };
  const { runnerName, password, email } = parsed.data;

  const limit = LIMITS.registerPerIp;
  const rl = await consume(db, `register:ip:${ip}`, limit.limit, limit.windowMs);
  if (!rl.ok) return tooMany(rl.retryAfterSec);

  const key = runnerNameKey(runnerName);
  const passwordHash = await hashPassword(password);
  try {
    const user = await db.user.create({
      data: { runnerName, runnerNameLower: key, passwordHash, email },
      select: { id: true },
    });
    return { ok: true, userId: user.id, token: await createSession(db, user.id) };
  } catch (err) {
    // Runner names are public, so saying "taken" leaks nothing.
    if (isUniqueViolation(err))
      return { ok: false, fieldErrors: { runnerName: "That runner name is taken." } };
    throw err;
  }
}

// ---------------------------------------------------------------- login

const loginInput = z.object({
  runnerName: z.string().trim().min(1).max(100),
  password: z.string().min(1).max(1000),
});

export async function authenticate(
  db: PrismaClient,
  raw: unknown,
  ip: string,
): Promise<{ ok: true; token: string; mustChangePassword: boolean } | Fail> {
  const parsed = loginInput.safeParse(raw);
  if (!parsed.success) return { ok: false, error: GENERIC_LOGIN_ERROR };
  const { runnerName, password } = parsed.data;
  const key = runnerNameKey(runnerName);

  const ipLimit = LIMITS.loginPerIp;
  const ipCheck = await consume(db, `login:ip:${ip}`, ipLimit.limit, ipLimit.windowMs);
  if (!ipCheck.ok) return tooMany(ipCheck.retryAfterSec);

  const acctLimit = LIMITS.loginFailuresPerAccount;
  const acctKey = `login:acct:${key}`;
  const acctCheck = await peek(db, acctKey, acctLimit.limit);
  if (!acctCheck.ok) return tooMany(acctCheck.retryAfterSec);

  const user = await db.user.findUnique({
    where: { runnerNameLower: key },
    select: { id: true, passwordHash: true, disabledAt: true, mustChangePassword: true },
  });
  // Always run a hash verification so response time does not reveal whether the account exists.
  const valid = await verifyPassword(user?.passwordHash ?? (await getDummyHash()), password);
  if (!user || !valid || user.disabledAt) {
    await consume(db, acctKey, acctLimit.limit, acctLimit.windowMs);
    return { ok: false, error: GENERIC_LOGIN_ERROR };
  }
  await clear(db, acctKey);
  // Opportunistic housekeeping so expired rows do not pile up (no cron needed).
  await db.session.deleteMany({ where: { expiresAt: { lt: new Date() } } });
  await sweepExpired(db);
  return { ok: true, token: await createSession(db, user.id), mustChangePassword: user.mustChangePassword };
}

// ---------------------------------------------------------------- change password

export const changePasswordInput = z
  .object({
    current: z.string().min(1, "Enter your current password.").max(1000),
    password: z.string().max(1000),
    confirm: z.string().max(1000),
  })
  .superRefine((v, ctx) => {
    if (v.password === v.current) {
      ctx.addIssue({ code: "custom", path: ["password"], message: "Pick a new password." });
    } else if (v.password !== v.confirm) {
      ctx.addIssue({ code: "custom", path: ["confirm"], message: "Passwords do not match." });
    }
  });

/** Changes the password, clears the forced-change flag and logs out every other session. */
export async function changePassword(
  db: PrismaClient,
  userId: string,
  raw: unknown,
  currentToken: string,
): Promise<{ ok: true } | Fail> {
  const parsed = changePasswordInput.safeParse(raw);
  if (!parsed.success) return { ok: false, fieldErrors: firstErrors(parsed.error) };
  const user = await db.user.findUnique({ where: { id: userId } });
  if (!user) return { ok: false, error: "Account not found." };
  const problem = passwordProblem(parsed.data.password, user.runnerName);
  if (problem) return { ok: false, fieldErrors: { password: problem } };
  if (!(await verifyPassword(user.passwordHash, parsed.data.current))) {
    return { ok: false, fieldErrors: { current: "Current password is incorrect." } };
  }
  await db.user.update({
    where: { id: userId },
    data: { passwordHash: await hashPassword(parsed.data.password), mustChangePassword: false },
  });
  await deleteUserSessions(db, userId, currentToken);
  return { ok: true };
}

// ---------------------------------------------------------------- preferences

export const prefsSchema = z.object({
  theme: z.enum(THEME_VALUES).default("system"),
});
export type Prefs = z.infer<typeof prefsSchema>;

export function readPrefs(value: unknown): Prefs {
  const parsed = prefsSchema.safeParse(value ?? {});
  return parsed.success ? parsed.data : { theme: "system" };
}

export const BIO_MAX = 280;

const profileInput = z.object({
  theme: z.enum(THEME_VALUES),
  email: optionalEmail,
  bio: z
    .string()
    // Drop control characters except newlines; keep it short.
    .transform((v) => v.replace(/[\u0000-\u0009\u000B-\u001F\u007F]/g, "").trim())
    .pipe(z.string().max(BIO_MAX, `Bio must be at most ${BIO_MAX} characters.`))
    .optional(),
  // "" = automatic default; otherwise one of the preset keys.
  avatar: z
    .string()
    .refine((v) => v === "" || isAvatarKey(v), "Pick one of the avatars.")
    .optional(),
});

export async function updateProfile(db: PrismaClient, userId: string, raw: unknown) {
  const parsed = profileInput.safeParse(raw);
  if (!parsed.success) return { ok: false as const, fieldErrors: firstErrors(parsed.error) };
  const user = await db.user.findUniqueOrThrow({ where: { id: userId }, select: { prefs: true } });
  const prefs = { ...readPrefs(user.prefs), theme: parsed.data.theme };
  await db.user.update({
    where: { id: userId },
    data: {
      prefs,
      email: parsed.data.email,
      ...(parsed.data.bio !== undefined ? { bio: parsed.data.bio || null } : {}),
      ...(parsed.data.avatar !== undefined ? { avatar: parsed.data.avatar || null } : {}),
    },
  });
  return { ok: true as const };
}

// ---------------------------------------------------------------- admin: players

const idSchema = z.string().min(1).max(64);

async function loadTarget(db: PrismaClient, rawId: unknown) {
  const id = idSchema.safeParse(rawId);
  if (!id.success) return null;
  return db.user.findUnique({ where: { id: id.data } });
}

/** Issues a one-time temporary password, forces a change at next login and logs the user out. */
export async function adminIssueTempPassword(
  db: PrismaClient,
  actor: Actor,
  userId: unknown,
): Promise<{ ok: true; tempPassword: string; runnerName: string } | Fail> {
  const user = await loadTarget(db, userId);
  if (!user) return { ok: false, error: "Player not found." };
  const tempPassword = newTempPassword();
  const passwordHash = await hashPassword(tempPassword);
  await db.$transaction(async (tx) => {
    await tx.user.update({ where: { id: user.id }, data: { passwordHash, mustChangePassword: true } });
    await tx.session.deleteMany({ where: { userId: user.id } });
    await audit(tx, actor, "player.temp_password", { userId: user.id, runnerName: user.runnerName });
  });
  return { ok: true, tempPassword, runnerName: user.runnerName };
}

export async function adminRename(
  db: PrismaClient,
  actor: Actor,
  userId: unknown,
  rawName: unknown,
): Promise<{ ok: true } | Fail> {
  const user = await loadTarget(db, userId);
  if (!user) return { ok: false, error: "Player not found." };
  const parsed = runnerNameSchema.safeParse(rawName);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message };
  const runnerName = parsed.data;
  if (runnerName === user.runnerName) return { ok: true };
  try {
    await db.$transaction(async (tx) => {
      await tx.user.update({
        where: { id: user.id },
        data: { runnerName, runnerNameLower: runnerNameKey(runnerName) },
      });
      await audit(tx, actor, "player.rename", {
        userId: user.id,
        before: user.runnerName,
        after: runnerName,
      });
    });
  } catch (err) {
    if (isUniqueViolation(err)) return { ok: false, error: "That runner name is taken." };
    throw err;
  }
  return { ok: true };
}

export async function adminSetDisabled(
  db: PrismaClient,
  actor: Actor,
  userId: unknown,
  disabled: boolean,
): Promise<{ ok: true } | Fail> {
  const user = await loadTarget(db, userId);
  if (!user) return { ok: false, error: "Player not found." };
  if (user.id === actor.id) return { ok: false, error: "You cannot disable your own account." };
  await db.$transaction(async (tx) => {
    await tx.user.update({ where: { id: user.id }, data: { disabledAt: disabled ? new Date() : null } });
    if (disabled) await tx.session.deleteMany({ where: { userId: user.id } });
    await audit(tx, actor, disabled ? "player.disable" : "player.enable", {
      userId: user.id,
      runnerName: user.runnerName,
    });
  });
  return { ok: true };
}

/** Makes a player an organizer (admin) or removes admin access. Never your own role. */
export async function adminSetRole(
  db: PrismaClient,
  actor: Actor,
  userId: unknown,
  rawRole: unknown,
): Promise<{ ok: true } | Fail> {
  const role = z.enum(["PLAYER", "ADMIN"]).safeParse(rawRole);
  if (!role.success) return { ok: false, error: "Invalid role." };
  const user = await loadTarget(db, userId);
  if (!user) return { ok: false, error: "Player not found." };
  if (user.id === actor.id) return { ok: false, error: "You cannot change your own role." };
  if (role.data === "ADMIN" && user.disabledAt) return { ok: false, error: "Enable the account first." };
  if (user.role === role.data) return { ok: true };
  if (role.data === "PLAYER" && (await db.user.count({ where: { role: "ADMIN" } })) <= 1) {
    return { ok: false, error: "There must always be at least one organizer." };
  }
  await db.$transaction(async (tx) => {
    await tx.user.update({ where: { id: user.id }, data: { role: role.data } });
    await audit(tx, actor, role.data === "ADMIN" ? "player.make_admin" : "player.remove_admin", {
      userId: user.id,
      runnerName: user.runnerName,
      before: user.role,
      after: role.data,
    });
  });
  return { ok: true };
}

/**
 * Deletes an account after typed confirmation of its runner name. Event results are kept but
 * anonymised: the player's entrant rows become guest rows named "Deleted player XXXX".
 */
export async function adminDelete(
  db: PrismaClient,
  actor: Actor,
  userId: unknown,
  confirmation: unknown,
): Promise<{ ok: true } | Fail> {
  const user = await loadTarget(db, userId);
  if (!user) return { ok: false, error: "Player not found." };
  if (user.id === actor.id) return { ok: false, error: "You cannot delete your own account." };
  if (typeof confirmation !== "string" || confirmation.trim() !== user.runnerName) {
    return { ok: false, error: `Type the runner name "${user.runnerName}" exactly to confirm.` };
  }
  await db.$transaction((tx) =>
    anonymiseAndDelete(tx, user, (anonName, counts) =>
      audit(tx, actor, "player.delete", {
        userId: user.id,
        before: user.runnerName,
        after: anonName,
        ...counts,
      }),
    ),
  );
  return { ok: true };
}

/**
 * Removes a person from the league while keeping event results consistent: their entries, saved
 * results, trophies and archived leaderboards switch to "Deleted player XXXX", then the account
 * (with its sessions and sign-ups) is deleted. The audit log keeps who did what.
 */
async function anonymiseAndDelete(
  tx: Prisma.TransactionClient,
  user: { id: string; runnerName: string },
  /** Runs after anonymising, before the account row is deleted (e.g. to write the audit row). */
  beforeDelete: (anonName: string, counts: Record<string, number>) => Promise<void>,
) {
  const anonName = `Deleted player ${user.id.slice(-4).toUpperCase()}`;
  const entrants = await tx.entrant.updateMany({
    where: { userId: user.id },
    data: { userId: null, guestName: anonName },
  });
  const records = await tx.eventRecord.updateMany({
    where: { userId: user.id },
    data: { userId: null, playerName: anonName },
  });
  const trophies = await tx.trophy.updateMany({
    where: { userId: user.id },
    data: { userId: null, playerName: anonName },
  });
  let snapshots = 0;
  for (const snap of await tx.leaderboardSnapshot.findMany()) {
    const data = snap.rowsJson as { prize?: string; rows?: { userId?: string | null; name?: string }[] };
    if (!data?.rows?.some((r) => r.userId === user.id)) continue;
    const rows = data.rows.map((r) =>
      r.userId === user.id ? { ...r, userId: null, key: `deleted:${anonName}`, name: anonName } : r,
    );
    await tx.leaderboardSnapshot.update({ where: { id: snap.id }, data: { rowsJson: { ...data, rows } } });
    snapshots++;
  }
  await beforeDelete(anonName, {
    entrantsAnonymised: entrants.count,
    recordsAnonymised: records.count,
    trophiesAnonymised: trophies.count,
    snapshotsAnonymised: snapshots,
  });
  await tx.user.delete({ where: { id: user.id } });
}

// ---------------------------------------------------------------- self-service

/** A player deletes their own account: password plus typed runner name. The last organizer cannot. */
export async function selfDeleteAccount(
  db: PrismaClient,
  userId: string,
  raw: { password?: unknown; confirm?: unknown },
): Promise<{ ok: true } | Fail> {
  const user = await db.user.findUnique({ where: { id: userId } });
  if (!user) return { ok: false, error: "Account not found." };
  if (typeof raw.confirm !== "string" || raw.confirm.trim() !== user.runnerName) {
    return { ok: false, error: `Type your runner name "${user.runnerName}" exactly to confirm.` };
  }
  if (typeof raw.password !== "string" || !(await verifyPassword(user.passwordHash, raw.password))) {
    return { ok: false, fieldErrors: { password: "Password is incorrect." } };
  }
  if (user.role === "ADMIN" && (await db.user.count({ where: { role: "ADMIN" } })) <= 1) {
    return { ok: false, error: "You are the only organizer. Make someone else an organizer first." };
  }
  await db.$transaction((tx) =>
    // The audit row is written before the account is deleted; its actor link is then cleared.
    anonymiseAndDelete(tx, user, (anonName, counts) =>
      audit(tx, { id: user.id, runnerName: user.runnerName }, "player.self_delete", {
        before: user.runnerName,
        after: anonName,
        ...counts,
      }),
    ),
  );
  return { ok: true };
}

/** Everything the league stores about a player, for "Download my data". No password hash. */
export async function exportMyData(db: PrismaClient, userId: string) {
  const user = await db.user.findUniqueOrThrow({
    where: { id: userId },
    select: {
      id: true,
      runnerName: true,
      email: true,
      bio: true,
      role: true,
      prefs: true,
      createdAt: true,
      updatedAt: true,
    },
  });
  const [signups, entries, eventRecords, trophies, sessions] = await Promise.all([
    db.signup.findMany({ where: { userId }, include: { event: { select: { name: true, date: true } } } }),
    db.entrant.findMany({ where: { userId }, include: { event: { select: { name: true, date: true } } } }),
    db.eventRecord.findMany({ where: { userId }, orderBy: { eventDate: "asc" } }),
    db.trophy.findMany({ where: { userId } }),
    db.session.findMany({
      where: { userId },
      select: { createdAt: true, lastSeenAt: true, expiresAt: true },
    }),
  ]);
  return {
    exportedAt: new Date().toISOString(),
    account: user,
    activeSessions: sessions,
    signups: signups.map((s) => ({ event: s.event.name, eventDate: s.event.date, signedUpAt: s.createdAt })),
    eventEntries: entries.map((e) => ({ event: e.event.name, eventDate: e.event.date, dropped: e.dropped })),
    eventResults: eventRecords,
    trophies,
  };
}

function isUniqueViolation(err: unknown): boolean {
  return typeof err === "object" && err !== null && (err as { code?: string }).code === "P2002";
}
