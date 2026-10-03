"use server";

import { revalidatePath } from "next/cache";
import { assertSameOrigin, requireUser } from "@/lib/auth/server";
import { db } from "@/lib/db";
import { type FormState, str } from "@/lib/forms/state";
import { playerSignUp, playerWithdraw } from "@/lib/tournament/registration";

function refresh(eventId: string) {
  revalidatePath("/");
  revalidatePath("/events");
  revalidatePath(`/events/${eventId}`);
  revalidatePath("/account");
}

export async function signUpAction(_p: FormState, form: FormData): Promise<FormState> {
  await assertSameOrigin();
  const user = await requireUser();
  const eventId = str(form, "eventId");
  const res = await playerSignUp(db, user.id, eventId);
  if (!res.ok) return { error: res.error };
  refresh(eventId);
  return { message: res.message };
}

export async function withdrawAction(_p: FormState, form: FormData): Promise<FormState> {
  await assertSameOrigin();
  const user = await requireUser();
  const eventId = str(form, "eventId");
  const res = await playerWithdraw(db, user.id, eventId);
  if (!res.ok) return { error: res.error };
  refresh(eventId);
  return { message: res.message };
}
