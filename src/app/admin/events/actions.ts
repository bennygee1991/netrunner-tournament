"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { adminActor } from "@/lib/auth/admin-action";
import { db } from "@/lib/db";
import { type FormState, str } from "@/lib/forms/state";
import { createOneOffEvent } from "@/lib/tournament/one-off";

export async function createOneOffAction(_p: FormState, form: FormData): Promise<FormState> {
  const actor = await adminActor();
  const res = await createOneOffEvent(db, actor, {
    name: str(form, "name"),
    date: str(form, "date"),
    matchFormat: str(form, "matchFormat"),
    swissRounds: str(form, "swissRounds"),
    cutSize: str(form, "cutSize"),
    cutFormat: str(form, "cutFormat"),
    startTime: str(form, "startTime"),
    venue: str(form, "venue"),
    notes: str(form, "notes"),
  });
  if (!res.ok) return { error: res.error, fieldErrors: res.fieldErrors };
  revalidatePath("/events");
  revalidatePath("/");
  redirect(`/admin/events/${res.eventId}?notice=event-created`);
}
