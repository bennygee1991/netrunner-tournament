import { z } from "zod";
import { CUT_SIZES, FINALE, SWISS_ROUNDS_MAX, SWISS_ROUNDS_MIN, planSeason } from "@/engine";
import type { PrismaClient } from "@/generated/prisma/client";
import { type Actor, audit } from "../audit";
import { fromIsoDate, isoDateSchema, toIsoDate } from "./dates";

type Fail = { ok: false; error?: string; fieldErrors?: Partial<Record<string, string>> };

function fieldErrors(err: z.ZodError) {
  const out: Partial<Record<string, string>> = {};
  for (const i of err.issues) out[String(i.path[0] ?? "form")] ??= i.message;
  return out;
}

const seasonInput = z.object({
  name: z.string().trim().min(1, "Give the season a name.").max(60),
  firstDate: isoDateSchema,
});

/** Creates a season and its 4 events (2 weeks apart; events 1-2 Month 1, 3-4 Month 2). */
export async function createSeason(
  db: PrismaClient,
  actor: Actor,
  raw: unknown,
): Promise<{ ok: true; seasonId: string } | Fail> {
  const parsed = seasonInput.safeParse(raw);
  if (!parsed.success) return { ok: false, fieldErrors: fieldErrors(parsed.error) };
  const { name, firstDate } = parsed.data;
  if (await db.season.findFirst({ where: { status: "ACTIVE" }, select: { id: true } })) {
    return { ok: false, error: "A season is already running. Archive it before creating a new one." };
  }
  const plan = planSeason(firstDate);
  const season = await db.$transaction(async (tx) => {
    const s = await tx.season.create({
      data: {
        name,
        startDate: fromIsoDate(firstDate),
        events: {
          create: plan.map((e) => ({
            index: e.index,
            name: e.finale ? "Season finale" : e.name,
            date: fromIsoDate(e.date),
            month: e.month,
            ...(e.finale ? { finale: true, swissRounds: FINALE.swissRounds, cutSize: FINALE.cutSize } : {}),
          })),
        },
      },
    });
    await audit(tx, actor, "season.create", { seasonId: s.id, name, firstDate, events: plan.length });
    return s;
  });
  return { ok: true, seasonId: season.id };
}

const eventSetupInput = z.object({
  name: z.string().trim().min(1, "Give the event a name.").max(60),
  date: isoDateSchema,
  month: z.coerce.number().pipe(z.union([z.literal(1), z.literal(2)])),
  matchFormat: z.enum(["SINGLE", "DOUBLE"]),
  swissRounds: z
    .string()
    .trim()
    .transform((v) => (v === "" ? null : Number(v)))
    .pipe(
      z
        .number()
        .int()
        .min(
          SWISS_ROUNDS_MIN,
          `Swiss rounds must be ${SWISS_ROUNDS_MIN}-${SWISS_ROUNDS_MAX}, or empty for automatic.`,
        )
        .max(
          SWISS_ROUNDS_MAX,
          `Swiss rounds must be ${SWISS_ROUNDS_MIN}-${SWISS_ROUNDS_MAX}, or empty for automatic.`,
        )
        .nullable(),
    ),
  cutSize: z.coerce
    .number()
    .refine((v) => (CUT_SIZES as readonly number[]).includes(v), "Cut must be none, top 4 or top 8."),
  // Optional details; omitted = unchanged, empty = cleared.
  startTime: z
    .string()
    .trim()
    .regex(/^$|^([01]\d|2[0-3]):[0-5]\d$/, "Use a 24-hour time like 18:30, or leave it empty.")
    .optional(),
  venue: z.string().trim().max(120, "Venue must be at most 120 characters.").optional(),
  notes: z.string().trim().max(1000, "Notes must be at most 1000 characters.").optional(),
  /** Season finale (double points, season-seeded cut); locked once the event starts. */
  finale: z.boolean().optional(),
});

const orNull = (v: string | undefined) => (v === undefined ? undefined : v === "" ? null : v);

/**
 * Event setup. Name, date and leaderboard month can be fixed any time; format, Swiss rounds and
 * cut size only before the event starts.
 */
export async function updateEventSetup(
  db: PrismaClient,
  actor: Actor,
  eventId: unknown,
  raw: unknown,
): Promise<{ ok: true } | Fail> {
  const id = z.string().min(1).max(64).safeParse(eventId);
  const event = id.success ? await db.event.findUnique({ where: { id: id.data } }) : null;
  if (!event) return { ok: false, error: "Event not found." };
  const parsed = eventSetupInput.safeParse(raw);
  if (!parsed.success) return { ok: false, fieldErrors: fieldErrors(parsed.error) };
  const v = parsed.data;
  const formatChanged =
    v.matchFormat !== event.matchFormat ||
    v.swissRounds !== event.swissRounds ||
    v.cutSize !== event.cutSize ||
    (v.finale !== undefined && v.finale !== event.finale);
  if (formatChanged && event.status !== "SIGNUP") {
    return { ok: false, error: "Format, Swiss rounds and cut size can only change before the event starts." };
  }
  const before = {
    name: event.name,
    date: toIsoDate(event.date),
    month: event.month,
    matchFormat: event.matchFormat,
    swissRounds: event.swissRounds,
    cutSize: event.cutSize,
    startTime: event.startTime,
    venue: event.venue,
    notes: event.notes,
    finale: event.finale,
  };
  const after = { ...v };
  await db.$transaction(async (tx) => {
    await tx.event.update({
      where: { id: event.id },
      data: {
        name: v.name,
        date: fromIsoDate(v.date),
        month: v.month,
        matchFormat: v.matchFormat,
        swissRounds: v.swissRounds,
        cutSize: v.cutSize,
        startTime: orNull(v.startTime),
        venue: orNull(v.venue),
        notes: orNull(v.notes),
        ...(v.finale !== undefined ? { finale: v.finale } : {}),
        version: { increment: 1 },
      },
    });
    // Keep permanent records in step if a finished event is renamed or re-dated.
    await tx.eventRecord.updateMany({
      where: { eventId: event.id },
      data: { eventName: v.name, eventDate: fromIsoDate(v.date) },
    });
    await tx.trophy.updateMany({ where: { eventId: event.id }, data: { eventName: v.name } });
    await audit(tx, actor, "event.setup", { eventId: event.id, before, after });
  });
  return { ok: true };
}

const prizesInput = z.object({
  month1: z.string().trim().max(200),
  month2: z.string().trim().max(200),
  season: z.string().trim().max(200),
});

export async function updatePrizes(db: PrismaClient, actor: Actor, seasonId: unknown, raw: unknown) {
  const id = z.string().min(1).max(64).safeParse(seasonId);
  const season = id.success ? await db.season.findUnique({ where: { id: id.data } }) : null;
  if (!season) return { ok: false as const, error: "Season not found." };
  const parsed = prizesInput.safeParse(raw);
  if (!parsed.success) return { ok: false as const, error: "Prize text is too long (200 characters max)." };
  await db.$transaction(async (tx) => {
    await tx.season.update({ where: { id: season.id }, data: { prizesJson: parsed.data } });
    await audit(tx, actor, "season.prizes", {
      seasonId: season.id,
      before: season.prizesJson as object,
      after: parsed.data,
    });
  });
  return { ok: true as const };
}

export type Prizes = z.infer<typeof prizesInput>;

export function readPrizes(v: unknown): Prizes {
  const parsed = prizesInput.partial().safeParse(v ?? {});
  const p = parsed.success ? parsed.data : {};
  return { month1: p.month1 ?? "", month2: p.month2 ?? "", season: p.season ?? "" };
}
