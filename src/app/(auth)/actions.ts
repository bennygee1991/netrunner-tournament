"use server";

import { redirect } from "next/navigation";
import { authenticate, registerUser } from "@/lib/auth/accounts";
import {
  assertSameOrigin,
  clearSessionCookie,
  clientIp,
  readSessionToken,
  safeNext,
  setSessionCookie,
} from "@/lib/auth/server";
import { deleteSession } from "@/lib/auth/sessions";
import { db } from "@/lib/db";
import { type FormState, str } from "@/lib/forms/state";

export async function registerAction(_prev: FormState, form: FormData): Promise<FormState> {
  await assertSameOrigin();
  const input = {
    runnerName: str(form, "runnerName"),
    password: str(form, "password"),
    confirm: str(form, "confirm"),
    email: str(form, "email"),
  };
  const result = await registerUser(db, input, await clientIp());
  if (!result.ok) {
    return {
      error: result.error,
      fieldErrors: result.fieldErrors,
      values: { runnerName: input.runnerName, email: input.email },
    };
  }
  await setSessionCookie(result.token);
  redirect("/account?welcome=1");
}

export async function loginAction(_prev: FormState, form: FormData): Promise<FormState> {
  await assertSameOrigin();
  const runnerName = str(form, "runnerName");
  const result = await authenticate(db, { runnerName, password: str(form, "password") }, await clientIp());
  if (!result.ok) return { error: result.error, values: { runnerName } };
  await setSessionCookie(result.token);
  redirect(result.mustChangePassword ? "/account/password" : safeNext(str(form, "next")));
}

export async function logoutAction(): Promise<void> {
  await assertSameOrigin();
  const token = await readSessionToken();
  if (token) await deleteSession(db, token);
  await clearSessionCookie();
  redirect("/");
}
