"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { adminDelete, adminIssueTempPassword, adminRename, adminSetDisabled } from "@/lib/auth/accounts";
import { adminActor } from "@/lib/auth/admin-action";
import { db } from "@/lib/db";
import { type FormState, str } from "@/lib/forms/state";

export type TempPasswordState = FormState & { tempPassword?: string };

export async function issueTempPasswordAction(
  _prev: TempPasswordState,
  form: FormData,
): Promise<TempPasswordState> {
  const actor = await adminActor();
  const result = await adminIssueTempPassword(db, actor, str(form, "userId"));
  if (!result.ok) return { error: result.error };
  revalidatePath("/admin/players");
  return {
    message: `Temporary password for ${result.runnerName}. It is shown only once; they must change it at next login.`,
    tempPassword: result.tempPassword,
  };
}

export async function renameAction(_prev: FormState, form: FormData): Promise<FormState> {
  const actor = await adminActor();
  const result = await adminRename(db, actor, str(form, "userId"), str(form, "runnerName"));
  if (!result.ok) return { error: result.error, values: { runnerName: str(form, "runnerName") } };
  revalidatePath("/admin/players");
  // Show the player under their new name (the list may be filtered by the old one).
  redirect(`/admin/players?q=${encodeURIComponent(str(form, "runnerName").trim())}&renamed=1`);
}

export async function setDisabledAction(_prev: FormState, form: FormData): Promise<FormState> {
  const actor = await adminActor();
  const result = await adminSetDisabled(db, actor, str(form, "userId"), str(form, "disabled") === "1");
  if (!result.ok) return { error: result.error };
  revalidatePath("/admin/players");
  return { message: "Updated." };
}

export async function deleteAction(_prev: FormState, form: FormData): Promise<FormState> {
  const actor = await adminActor();
  const result = await adminDelete(db, actor, str(form, "userId"), str(form, "confirm"));
  if (!result.ok) return { error: result.error };
  revalidatePath("/admin/players");
  return { message: "Account deleted. Their results are kept under an anonymous name." };
}
