"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { adminActor } from "@/lib/auth/admin-action";
import { db } from "@/lib/db";
import { type FormState, str } from "@/lib/forms/state";
import { addStarterGuides, createGuide, deleteGuide, restoreGuideRevision, updateGuide } from "@/lib/guides";

function input(form: FormData) {
  return {
    title: str(form, "title"),
    slug: str(form, "slug"),
    body: str(form, "body"),
    sortOrder: str(form, "sortOrder") || "100",
    published: form.get("published") === "on",
  };
}

function refresh() {
  revalidatePath("/guides", "layout");
  revalidatePath("/admin/guides", "layout");
}

export async function createGuideAction(_p: FormState, form: FormData): Promise<FormState> {
  const actor = await adminActor();
  const values = input(form);
  const res = await createGuide(db, actor, values);
  if (!res.ok)
    return {
      error: res.error,
      fieldErrors: res.fieldErrors,
      values: { ...values, sortOrder: values.sortOrder, published: values.published ? "on" : "" },
    };
  refresh();
  redirect(`/admin/guides/${res.id}?notice=guide-saved`);
}

export async function updateGuideAction(_p: FormState, form: FormData): Promise<FormState> {
  const actor = await adminActor();
  const values = input(form);
  const res = await updateGuide(db, actor, str(form, "pageId"), values);
  if (!res.ok)
    return {
      error: res.error,
      fieldErrors: res.fieldErrors,
      values: { ...values, published: values.published ? "on" : "" },
    };
  refresh();
  return { message: "Saved." };
}

export async function restoreGuideAction(_p: FormState, form: FormData): Promise<FormState> {
  const actor = await adminActor();
  const pageId = str(form, "pageId");
  const res = await restoreGuideRevision(db, actor, pageId, str(form, "revisionId"));
  if (!res.ok) return { error: res.error };
  refresh();
  redirect(`/admin/guides/${pageId}?notice=guide-restored`);
}

export async function deleteGuideAction(_p: FormState, form: FormData): Promise<FormState> {
  const actor = await adminActor();
  const res = await deleteGuide(db, actor, str(form, "pageId"), str(form, "confirm"));
  if (!res.ok) return { error: res.error };
  refresh();
  redirect("/admin/guides?notice=guide-deleted");
}

export async function addStarterGuidesAction(): Promise<FormState> {
  const actor = await adminActor();
  await addStarterGuides(db, actor);
  refresh();
  // The "Get started" card disappears once pages exist, so confirm via a notice.
  redirect("/admin/guides?notice=guides-starter");
}
