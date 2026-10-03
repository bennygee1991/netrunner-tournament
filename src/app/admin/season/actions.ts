"use server";

import { revalidatePath } from "next/cache";
import { adminActor } from "@/lib/auth/admin-action";
import { db } from "@/lib/db";
import { type FormState, str } from "@/lib/forms/state";
import { createSeason, updatePrizes } from "@/lib/tournament/season";

export async function createSeasonAction(_prev: FormState, form: FormData): Promise<FormState> {
  const actor = await adminActor();
  const input = { name: str(form, "name"), firstDate: str(form, "firstDate") };
  const result = await createSeason(db, actor, input);
  if (!result.ok) return { error: result.error, fieldErrors: result.fieldErrors, values: input };
  revalidatePath("/", "layout");
  return { message: "Season created with 4 events." };
}

export async function updatePrizesAction(_prev: FormState, form: FormData): Promise<FormState> {
  const actor = await adminActor();
  const result = await updatePrizes(db, actor, str(form, "seasonId"), {
    month1: str(form, "month1"),
    month2: str(form, "month2"),
    season: str(form, "season"),
  });
  if (!result.ok) return { error: result.error };
  revalidatePath("/", "layout");
  return { message: "Prizes saved." };
}
