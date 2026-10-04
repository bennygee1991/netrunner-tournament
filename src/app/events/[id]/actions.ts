"use server";

import { revalidatePath } from "next/cache";
import { assertSameOrigin, requireUser } from "@/lib/auth/server";
import { db } from "@/lib/db";
import { type FormState, str } from "@/lib/forms/state";
import { opPickSides } from "@/lib/tournament/ops";
import { playerReport } from "@/lib/tournament/reports";

/** A player reports one game of their own match (counts once the organizer approves it). */
export async function reportResultAction(_p: FormState, form: FormData): Promise<FormState> {
  await assertSameOrigin();
  const user = await requireUser();
  const eventId = str(form, "eventId");
  const res = await playerReport(db, user.id, eventId, {
    phase: str(form, "phase"),
    round: str(form, "round"),
    match: str(form, "match"),
    game: str(form, "game"),
    outcome: str(form, "outcome"),
  });
  if (!res.ok) return { error: res.error };
  revalidatePath(`/events/${eventId}`);
  revalidatePath(`/admin/events/${eventId}`);
  return { message: res.message };
}

/** Series cut: the higher seed picks who plays Corp in game 1. */
export async function pickSidesAction(_p: FormState, form: FormData): Promise<FormState> {
  await assertSameOrigin();
  const user = await requireUser();
  const eventId = str(form, "eventId");
  const res = await opPickSides(
    db,
    { id: user.id, runnerName: user.runnerName },
    eventId,
    { round: str(form, "round"), match: str(form, "match"), corpId: str(form, "corpId") },
    user.id,
  );
  if (!res.ok) return { error: res.error };
  revalidatePath(`/events/${eventId}`);
  revalidatePath(`/admin/events/${eventId}`);
  return { message: "Sides picked. Good luck!" };
}
