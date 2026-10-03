"use client";

import { useActionState } from "react";
import { SubmitButton } from "@/components/submit-button";
import { Field, FormMessage } from "@/components/ui";
import type { FormState } from "@/lib/forms/state";
import { GUIDE_BODY_MAX } from "@/lib/guides";

export function GuideForm({
  action,
  page,
  submitText,
}: {
  action: (s: FormState, f: FormData) => Promise<FormState>;
  page?: { id: string; title: string; slug: string; body: string; sortOrder: number; published: boolean };
  submitText: string;
}) {
  const [state, formAction] = useActionState(action, {});
  const fe = state.fieldErrors ?? {};
  const v = state.values;
  return (
    <form action={formAction} noValidate>
      {page && <input type="hidden" name="pageId" value={page.id} />}
      {state.error && <FormMessage tone="error">{state.error}</FormMessage>}
      {state.message && <FormMessage tone="ok">{state.message}</FormMessage>}
      <Field
        id="guide-title"
        label="Title"
        name="title"
        defaultValue={v?.title ?? page?.title}
        error={fe.title}
        maxLength={80}
      />
      <Field
        id="guide-slug"
        label="Web address (optional)"
        name="slug"
        defaultValue={v?.slug ?? page?.slug}
        error={fe.slug}
        maxLength={60}
        autoCapitalize="none"
        hint="The end of the page link, e.g. how-to-play → /guides/how-to-play. Left empty, it is made from the title."
      />
      <div className="mb-4 flex flex-col gap-1">
        <label htmlFor="guide-body" className="font-mono text-xs tracking-widest text-muted uppercase">
          Page text
        </label>
        <textarea
          id="guide-body"
          name="body"
          rows={16}
          maxLength={GUIDE_BODY_MAX}
          defaultValue={v?.body ?? page?.body}
          aria-invalid={fe.body ? true : undefined}
          aria-describedby="guide-body-hint"
          className="rounded border border-border bg-bg px-3 py-2 font-mono text-sm text-fg focus:border-cyan"
        />
        <p id="guide-body-hint" className="text-xs text-muted">
          Formatting: <code>## Heading</code>, <code>**bold**</code>, <code>_italic_</code>,{" "}
          <code>- list item</code>, <code>1. numbered</code>, <code>[link text](https://…)</code>,{" "}
          <code>&gt; note</code>. A blank line starts a new paragraph.
        </p>
        {fe.body && <p className="text-sm text-danger">{fe.body}</p>}
      </div>
      <Field
        id="guide-order"
        label="Position in the list"
        name="sortOrder"
        type="number"
        inputMode="numeric"
        min={0}
        max={999}
        defaultValue={v?.sortOrder ?? page?.sortOrder ?? 100}
        hint="Lower numbers are listed first."
      />
      <label className="mb-4 flex min-h-11 items-center gap-3">
        <input
          type="checkbox"
          name="published"
          defaultChecked={v ? v.published === "on" : (page?.published ?? false)}
          className="size-5 accent-cyan"
        />
        Published (visible to everyone)
      </label>
      <SubmitButton pendingText="Saving…">{submitText}</SubmitButton>
    </form>
  );
}
