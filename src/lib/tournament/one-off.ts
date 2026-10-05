import { z } from "zod";
import type { PrismaClient } from "@/generated/prisma/client";
import { type Actor, audit } from "../audit";
import { fromIsoDate } from "./dates";
import { clearOutcome } from "./records";
import { eventSetupInput, fieldErrors } from "./season";

type Fail = { ok: false; error?: string; fieldErrors?: Partial<Record<string, string>> };

/** A one-off event: same format choices as season events, but no month, finale or league points. */
const oneOffInput = eventSetupInput.omit({ month: true, finale: true }).extend({
  cutFormat: z.enum(["SINGLE", "SERIES"]),
});

const orNull = (v: string | undefined) => (v === undefined || v === "" ? null : v);

/** Creates a one-off event (not part of any season), ready for sign-ups. */
export async function createOneOffEvent(
  db: PrismaClient,
  actor: Actor,
  raw: unknown,
): Promise<{ ok: true; eventId: string } | Fail> {
  const parsed = oneOffInput.safeParse(raw);
  if (!parsed.success) return { ok: false, fieldErrors: fieldErrors(parsed.error) };
  const v = parsed.data;
  const event = await db.$transaction(async (tx) => {
    const e = await tx.event.create({
      data: {
        seasonId: null,
        index: 0,
        name: v.name,
        date: fromIsoDate(v.date),
        month: 1,
        matchFormat: v.matchFormat,
        swissRounds: v.swissRounds,
        cutSize: v.cutSize,
        cutFormat: v.cutFormat,
        startTime: orNull(v.startTime),
        venue: orNull(v.venue),
        notes: orNull(v.notes),
      },
    });
    await audit(tx, actor, "event.create_one_off", { eventId: e.id, ...v });
    return e;
  });
  return { ok: true, eventId: event.id };
}

/**
 * Deletes a one-off event with its entrants, rounds, results, records and trophies. Season events
 * cannot be deleted this way (they go when the season is archived). Requires typing the event name.
 */
export async function deleteOneOffEvent(
  db: PrismaClient,
  actor: Actor,
  eventId: unknown,
  confirmation: unknown,
): Promise<{ ok: true; message: string } | Fail> {
  const id = z.string().min(1).max(64).safeParse(eventId);
  const event = id.success ? await db.event.findUnique({ where: { id: id.data } }) : null;
  if (!event || event.seasonId !== null) return { ok: false, error: "One-off event not found." };
  if (typeof confirmation !== "string" || confirmation.trim() !== event.name) {
    return { ok: false, error: `Type the event name "${event.name}" exactly to confirm.` };
  }
  await db.$transaction(async (tx) => {
    await clearOutcome(tx, event.id);
    await tx.event.delete({ where: { id: event.id } });
    await audit(tx, actor, "event.delete_one_off", {
      eventId: event.id,
      name: event.name,
      status: event.status,
    });
  });
  return { ok: true, message: `${event.name} deleted.` };
}

/** One-off events for the public list and the admin page, upcoming first, then finished. */
export async function listOneOffEvents(db: PrismaClient) {
  const events = await db.event.findMany({
    where: { seasonId: null },
    orderBy: { date: "asc" },
    include: { _count: { select: { entrants: true, signups: true } } },
  });
  return {
    upcoming: events.filter((e) => e.status !== "DONE"),
    finished: events.filter((e) => e.status === "DONE").reverse(),
  };
}
