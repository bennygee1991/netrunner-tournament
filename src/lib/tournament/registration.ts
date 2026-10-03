import { z } from "zod";
import type { PrismaClient } from "@/generated/prisma/client";
import { type Actor, audit } from "../audit";
import { runnerNameKey, runnerNameSchema } from "../validation";

type Result = { ok: true; message?: string } | { ok: false; error: string };

const idSchema = z.string().min(1).max(64);

async function findEvent(db: PrismaClient, eventId: unknown) {
  const id = idSchema.safeParse(eventId);
  if (!id.success) return null;
  return db.event.findUnique({ where: { id: id.data }, include: { season: { select: { status: true } } } });
}

// ------------------------------------------------------------------ players

/** A player signs up for an open event (idempotent). */
export async function playerSignUp(db: PrismaClient, userId: string, eventId: unknown): Promise<Result> {
  const event = await findEvent(db, eventId);
  if (!event || event.season.status !== "ACTIVE") return { ok: false, error: "Event not found." };
  if (event.status !== "SIGNUP") return { ok: false, error: "Sign-ups for this event are closed." };
  await db.signup.upsert({
    where: { eventId_userId: { eventId: event.id, userId } },
    create: { eventId: event.id, userId },
    update: {},
  });
  return { ok: true, message: `You're signed up for ${event.name}.` };
}

/** A player withdraws before the event starts (also removes them from the entrants if approved). */
export async function playerWithdraw(db: PrismaClient, userId: string, eventId: unknown): Promise<Result> {
  const event = await findEvent(db, eventId);
  if (!event) return { ok: false, error: "Event not found." };
  if (event.status !== "SIGNUP") {
    return { ok: false, error: "The event has started. Ask the organizer to drop you." };
  }
  await db.$transaction([
    db.signup.deleteMany({ where: { eventId: event.id, userId } }),
    db.entrant.deleteMany({ where: { eventId: event.id, userId } }),
    db.event.update({ where: { id: event.id }, data: { version: { increment: 1 } } }),
  ]);
  return { ok: true, message: `You've withdrawn from ${event.name}.` };
}

// ------------------------------------------------------------------ admin

function canAddEntrants(status: string) {
  // Before the event, or as a late addition during Swiss (joins the next pairing with zero points).
  return status === "SIGNUP" || status === "SWISS";
}

/** Approves one player's sign-up into an entrant. */
export async function approveSignup(
  db: PrismaClient,
  actor: Actor,
  eventId: unknown,
  userId: unknown,
): Promise<Result> {
  const event = await findEvent(db, eventId);
  const uid = idSchema.safeParse(userId);
  if (!event || !uid.success) return { ok: false, error: "Sign-up not found." };
  if (!canAddEntrants(event.status))
    return { ok: false, error: "Players can no longer be added to this event." };
  const signup = await db.signup.findUnique({
    where: { eventId_userId: { eventId: event.id, userId: uid.data } },
    include: { user: { select: { runnerName: true, disabledAt: true } } },
  });
  if (!signup) return { ok: false, error: "Sign-up not found." };
  if (signup.user.disabledAt) return { ok: false, error: "That account is disabled." };
  await db.$transaction(async (tx) => {
    await tx.entrant.upsert({
      where: { eventId_userId: { eventId: event.id, userId: uid.data } },
      create: { eventId: event.id, userId: uid.data },
      update: {},
    });
    await tx.event.update({ where: { id: event.id }, data: { version: { increment: 1 } } });
    await audit(tx, actor, "event.approve", {
      eventId: event.id,
      eventName: event.name,
      player: signup.user.runnerName,
      late: event.status === "SWISS",
    });
  });
  return { ok: true };
}

/** Approves every pending sign-up. */
export async function approveAllSignups(db: PrismaClient, actor: Actor, eventId: unknown): Promise<Result> {
  const event = await findEvent(db, eventId);
  if (!event) return { ok: false, error: "Event not found." };
  if (!canAddEntrants(event.status))
    return { ok: false, error: "Players can no longer be added to this event." };
  const pending = await db.signup.findMany({
    where: { eventId: event.id, user: { disabledAt: null, entrants: { none: { eventId: event.id } } } },
    include: { user: { select: { runnerName: true } } },
  });
  if (!pending.length) return { ok: true, message: "No pending sign-ups." };
  await db.$transaction(async (tx) => {
    await tx.entrant.createMany({
      data: pending.map((s) => ({ eventId: event.id, userId: s.userId })),
      skipDuplicates: true,
    });
    await tx.event.update({ where: { id: event.id }, data: { version: { increment: 1 } } });
    await audit(tx, actor, "event.approve_all", {
      eventId: event.id,
      eventName: event.name,
      players: pending.map((s) => s.user.runnerName),
    });
  });
  return { ok: true, message: `Approved ${pending.length} sign-up${pending.length === 1 ? "" : "s"}.` };
}

/**
 * Adds a player by name: an existing account is added as itself; any other name becomes a walk-in
 * guest (which can be linked to an account later).
 */
export async function addPlayerByName(
  db: PrismaClient,
  actor: Actor,
  eventId: unknown,
  rawName: unknown,
): Promise<Result> {
  const event = await findEvent(db, eventId);
  if (!event) return { ok: false, error: "Event not found." };
  if (!canAddEntrants(event.status))
    return { ok: false, error: "Players can no longer be added to this event." };
  const parsed = runnerNameSchema.safeParse(rawName);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]!.message };
  const name = parsed.data;
  const key = runnerNameKey(name);

  const user = await db.user.findUnique({ where: { runnerNameLower: key } });
  if (user?.disabledAt) return { ok: false, error: "That account is disabled." };

  const existing = await db.entrant.findMany({
    where: { eventId: event.id },
    include: { user: { select: { runnerNameLower: true } } },
  });
  const clash = existing.some(
    (e) =>
      (user && e.userId === user.id) ||
      e.user?.runnerNameLower === key ||
      (e.guestName && runnerNameKey(e.guestName) === key),
  );
  if (clash) return { ok: false, error: `${name} is already entered.` };

  await db.$transaction(async (tx) => {
    await tx.entrant.create({
      data: user ? { eventId: event.id, userId: user.id } : { eventId: event.id, guestName: name },
    });
    await tx.event.update({ where: { id: event.id }, data: { version: { increment: 1 } } });
    await audit(tx, actor, user ? "event.add_player" : "event.add_guest", {
      eventId: event.id,
      eventName: event.name,
      player: user?.runnerName ?? name,
      late: event.status === "SWISS",
    });
  });
  const who = user ? user.runnerName : `${name} (walk-in guest)`;
  return { ok: true, message: event.status === "SWISS" ? `${who} joins the next pairing.` : `Added ${who}.` };
}

/** Removes an entrant before the event starts (their sign-up is removed too). */
export async function removeEntrant(
  db: PrismaClient,
  actor: Actor,
  eventId: unknown,
  entrantId: unknown,
): Promise<Result> {
  const event = await findEvent(db, eventId);
  const eid = idSchema.safeParse(entrantId);
  if (!event || !eid.success) return { ok: false, error: "Entrant not found." };
  if (event.status !== "SIGNUP")
    return { ok: false, error: "The event has started. Drop the player instead." };
  const entrant = await db.entrant.findFirst({
    where: { id: eid.data, eventId: event.id },
    include: { user: { select: { runnerName: true } } },
  });
  if (!entrant) return { ok: false, error: "Entrant not found." };
  await db.$transaction(async (tx) => {
    await tx.entrant.delete({ where: { id: entrant.id } });
    if (entrant.userId) await tx.signup.deleteMany({ where: { eventId: event.id, userId: entrant.userId } });
    await tx.event.update({ where: { id: event.id }, data: { version: { increment: 1 } } });
    await audit(tx, actor, "event.remove_entrant", {
      eventId: event.id,
      eventName: event.name,
      player: entrant.user?.runnerName ?? entrant.guestName,
    });
  });
  return { ok: true };
}

/** Rejects a pending sign-up (deletes it). */
export async function rejectSignup(
  db: PrismaClient,
  actor: Actor,
  eventId: unknown,
  userId: unknown,
): Promise<Result> {
  const event = await findEvent(db, eventId);
  const uid = idSchema.safeParse(userId);
  if (!event || !uid.success) return { ok: false, error: "Sign-up not found." };
  const signup = await db.signup.findUnique({
    where: { eventId_userId: { eventId: event.id, userId: uid.data } },
    include: { user: { select: { runnerName: true } } },
  });
  if (!signup) return { ok: false, error: "Sign-up not found." };
  await db.$transaction(async (tx) => {
    await tx.signup.delete({ where: { id: signup.id } });
    await audit(tx, actor, "event.reject_signup", {
      eventId: event.id,
      eventName: event.name,
      player: signup.user.runnerName,
    });
  });
  return { ok: true };
}

/**
 * Links a walk-in guest's results to an account: every guest entrant with that name (in events
 * where the account is not already entered), plus permanent records and trophies under that name.
 */
export async function linkGuestToAccount(
  db: PrismaClient,
  actor: Actor,
  rawGuestName: unknown,
  userId: unknown,
): Promise<Result> {
  const name = runnerNameSchema.safeParse(rawGuestName);
  const uid = idSchema.safeParse(userId);
  if (!name.success || !uid.success)
    return { ok: false, error: "Enter the walk-in name exactly as it was entered." };
  const user = await db.user.findUnique({ where: { id: uid.data } });
  if (!user) return { ok: false, error: "Player not found." };
  const key = runnerNameKey(name.data);
  const guests = (await db.entrant.findMany({ where: { userId: null, guestName: { not: null } } })).filter(
    (e) => runnerNameKey(e.guestName!) === key,
  );
  const records = (await db.eventRecord.findMany({ where: { userId: null } })).filter(
    (r) => runnerNameKey(r.playerName) === key,
  );
  if (!guests.length && !records.length)
    return { ok: false, error: `No walk-in results found for "${name.data}".` };

  const alreadyIn = new Set(
    (await db.entrant.findMany({ where: { userId: user.id }, select: { eventId: true } })).map(
      (e) => e.eventId,
    ),
  );
  const linkable = guests.filter((g) => !alreadyIn.has(g.eventId));
  const skipped = guests.length - linkable.length;

  await db.$transaction(async (tx) => {
    for (const g of linkable) {
      await tx.entrant.update({ where: { id: g.id }, data: { userId: user.id, guestName: null } });
      await tx.event.update({ where: { id: g.eventId }, data: { version: { increment: 1 } } });
    }
    await tx.eventRecord.updateMany({
      where: { id: { in: records.map((r) => r.id) } },
      data: { userId: user.id, playerName: user.runnerName },
    });
    const trophies = (await tx.trophy.findMany({ where: { userId: null } })).filter(
      (t) => runnerNameKey(t.playerName) === key,
    );
    await tx.trophy.updateMany({
      where: { id: { in: trophies.map((t) => t.id) } },
      data: { userId: user.id, playerName: user.runnerName },
    });
    await audit(tx, actor, "player.link_guest", {
      guestName: name.data,
      userId: user.id,
      runnerName: user.runnerName,
      entrantsLinked: linkable.length,
      recordsLinked: records.length,
      skippedSameEvent: skipped,
    });
  });
  const parts = [
    `Linked ${linkable.length} event entr${linkable.length === 1 ? "y" : "ies"} and ${records.length} result record${records.length === 1 ? "" : "s"} to ${user.runnerName}.`,
  ];
  if (skipped) parts.push(`${skipped} skipped because ${user.runnerName} was already entered in that event.`);
  return { ok: true, message: parts.join(" ") };
}
