"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { adminActor } from "@/lib/auth/admin-action";
import { db } from "@/lib/db";
import { type FormState, str } from "@/lib/forms/state";
import { archiveSeason, resetEverything } from "@/lib/tournament/resets";
import { createSeason, updatePrizes } from "@/lib/tournament/season";

export async function createSeasonAction(_prev: FormState, form: FormData): Promise<FormState> {
  const actor = await adminActor();
  const input = { name: str(form, "name"), firstDate: str(form, "firstDate") };
  // Per-event format toggles (e1.* .. e4.*); omitted entirely if the form had none.
  const events = form.has("e1.matchFormat")
    ? [1, 2, 3, 4].map((n) => ({
        matchFormat: str(form, `e${n}.matchFormat`),
        swissRounds: str(form, `e${n}.swissRounds`),
        cutSize: str(form, `e${n}.cutSize`),
        cutFormat: str(form, `e${n}.cutFormat`),
      }))
    : undefined;
  const result = await createSeason(db, actor, { ...input, events });
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

export async function archiveSeasonAction(_prev: FormState, form: FormData): Promise<FormState> {
  const actor = await adminActor();
  const result = await archiveSeason(db, actor, str(form, "seasonId"), str(form, "confirm"));
  if (!result.ok) return { error: result.error };
  revalidatePath("/", "layout");
  redirect("/admin/season?notice=season-archived");
}

export async function resetAllAction(_prev: FormState, form: FormData): Promise<FormState> {
  const actor = await adminActor();
  const deleteAccounts = form.get("deleteAccounts") === "on";
  const result = await resetEverything(db, actor, str(form, "confirm"), deleteAccounts);
  if (!result.ok) return { error: result.error };
  revalidatePath("/", "layout");
  redirect(`/admin/season?notice=${deleteAccounts ? "reset-all-accounts" : "reset-all"}`);
}
