"use client";

import { useActionState } from "react";
import { SubmitButton } from "@/components/submit-button";
import { Field, FormMessage } from "@/components/ui";
import { Avatar } from "@/components/avatar";
import { ThemePicker } from "@/components/theme-picker";
import { AVATAR_KEYS, avatarLabel } from "@/lib/avatars";
import { initialFormState } from "@/lib/forms/state";
import { updateProfileAction } from "./actions";

export function ProfileForm({
  theme,
  email,
  bio,
  avatar,
  userId,
}: {
  theme: string;
  email: string;
  bio: string;
  avatar: string;
  userId: string;
}) {
  const [state, action] = useActionState(updateProfileAction, initialFormState);
  const fe = state.fieldErrors ?? {};
  const currentTheme = state.values?.theme ?? theme;
  const currentAvatar = state.values?.avatar ?? avatar;
  return (
    <form action={action} noValidate>
      {state.message && <FormMessage tone="ok">{state.message}</FormMessage>}
      <fieldset className="mb-4">
        <legend className="mb-2 font-mono text-xs tracking-widest text-muted uppercase">Avatar</legend>
        <div className="grid grid-cols-4 gap-2 sm:grid-cols-6">
          <label className="flex cursor-pointer flex-col items-center gap-1 rounded border border-border p-1 has-[:checked]:border-cyan has-[:focus-visible]:outline has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-cyan">
            <input
              type="radio"
              name="avatar"
              value=""
              defaultChecked={currentAvatar === ""}
              className="sr-only"
            />
            <Avatar avatar={null} seed={userId} size={48} />
            <span className="font-mono text-[10px] text-muted uppercase">Auto</span>
          </label>
          {AVATAR_KEYS.map((key) => (
            <label
              key={key}
              title={avatarLabel(key)}
              className="flex cursor-pointer items-center justify-center rounded border border-border p-1 has-[:checked]:border-cyan has-[:focus-visible]:outline has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-cyan"
            >
              <input
                type="radio"
                name="avatar"
                value={key}
                defaultChecked={currentAvatar === key}
                className="sr-only"
                aria-label={avatarLabel(key)}
              />
              <Avatar avatar={key} seed={userId} size={48} />
            </label>
          ))}
        </div>
        {fe.avatar && <p className="mt-1 text-sm text-danger">{fe.avatar}</p>}
      </fieldset>
      <ThemePicker saved={theme} selected={currentTheme} />
      <Field
        label="Email (optional)"
        name="email"
        type="email"
        autoComplete="email"
        defaultValue={state.values?.email ?? email}
        error={fe.email}
        hint="Only visible to the organizer."
      />
      <div className="mb-4 flex flex-col gap-1">
        <label htmlFor="f-bio" className="font-mono text-xs tracking-widest text-muted uppercase">
          Bio (public, optional)
        </label>
        <textarea
          id="f-bio"
          name="bio"
          rows={3}
          maxLength={280}
          defaultValue={state.values?.bio ?? bio}
          aria-invalid={fe.bio ? true : undefined}
          className="rounded border border-border bg-bg px-3 py-2 text-base text-fg focus:border-cyan"
          placeholder="Favourite faction, local meta, catchphrase…"
        />
        <p className="text-xs text-muted">Shown on your public profile. Up to 280 characters.</p>
        {fe.bio && <p className="text-sm text-danger">{fe.bio}</p>}
      </div>
      <SubmitButton pendingText="Saving…" variant="secondary">
        Save profile
      </SubmitButton>
    </form>
  );
}
