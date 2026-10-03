"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { changePassword, updateProfile } from "@/lib/auth/accounts";
import { assertSameOrigin, readSessionToken, requireUser } from "@/lib/auth/server";
import { db } from "@/lib/db";
import { type FormState, str } from "@/lib/forms/state";

export async function changePasswordAction(_prev: FormState, form: FormData): Promise<FormState> {
  await assertSameOrigin();
  const user = await requireUser({ allowForcedChange: true });
  const token = (await readSessionToken())!;
  const result = await changePassword(
    db,
    user.id,
    { current: str(form, "current"), password: str(form, "password"), confirm: str(form, "confirm") },
    token,
  );
  if (!result.ok) return { error: result.error, fieldErrors: result.fieldErrors };
  redirect("/account?changed=1");
}

export async function updateProfileAction(_prev: FormState, form: FormData): Promise<FormState> {
  await assertSameOrigin();
  const user = await requireUser();
  const input = { theme: str(form, "theme"), email: str(form, "email"), bio: str(form, "bio") };
  const result = await updateProfile(db, user.id, input);
  if (!result.ok) return { fieldErrors: result.fieldErrors, values: input };
  revalidatePath("/", "layout");
  return { message: "Saved." };
}
