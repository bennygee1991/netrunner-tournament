"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { changePassword, selfDeleteAccount, updateProfile } from "@/lib/auth/accounts";
import { assertSameOrigin, clearSessionCookie, readSessionToken, requireUser } from "@/lib/auth/server";
import { db } from "@/lib/db";
import { setFeaturedBadges } from "@/lib/tournament/badges";
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
  const input = {
    theme: str(form, "theme"),
    email: str(form, "email"),
    bio: str(form, "bio"),
    avatar: str(form, "avatar"),
  };
  const result = await updateProfile(db, user.id, input);
  if (!result.ok) return { fieldErrors: result.fieldErrors, values: input };
  revalidatePath("/", "layout");
  return { message: "Saved." };
}

export async function updateFeaturedAction(_prev: FormState, form: FormData): Promise<FormState> {
  await assertSameOrigin();
  const user = await requireUser();
  const keys = form.getAll("featured").filter((v): v is string => typeof v === "string");
  const result = await setFeaturedBadges(db, user.id, keys);
  if (!result.ok) return { error: result.error };
  revalidatePath("/players", "layout");
  return { message: "Saved." };
}

export async function deleteMyAccountAction(_prev: FormState, form: FormData): Promise<FormState> {
  await assertSameOrigin();
  const user = await requireUser({ allowForcedChange: true });
  const result = await selfDeleteAccount(db, user.id, {
    password: str(form, "password"),
    confirm: str(form, "confirm"),
  });
  if (!result.ok) return { error: result.error, fieldErrors: result.fieldErrors };
  await clearSessionCookie();
  revalidatePath("/", "layout");
  redirect("/?notice=account-deleted");
}
