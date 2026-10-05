"use client";

import { useEffect, useState } from "react";
import { THEMES, THEME_TOKENS, type ThemeValue } from "@/lib/themes";

function apply(theme: string) {
  const el = document.documentElement;
  if (theme === "system") el.removeAttribute("data-theme");
  else el.setAttribute("data-theme", theme);
}

/** Colour chips for a theme card (system shows the classic dark and light side by side). */
function Swatch({ theme }: { theme: ThemeValue }) {
  const t = theme === "system" ? null : THEME_TOKENS[theme];
  if (!t) {
    const [d, l] = [THEME_TOKENS.dark, THEME_TOKENS.light];
    return (
      <span aria-hidden className="flex h-9 w-full overflow-hidden rounded border border-border">
        <span className="flex-1" style={{ background: d.bg, borderRight: `6px solid ${d.cyan}` }} />
        <span className="flex-1" style={{ background: l.bg, borderLeft: `6px solid ${l.cyan}` }} />
      </span>
    );
  }
  return (
    <span
      aria-hidden
      className="flex h-9 w-full items-center gap-1 rounded border px-1.5"
      style={{ background: t.bg, borderColor: t.border }}
    >
      <span
        className="h-4 flex-1 rounded-sm"
        style={{ background: t.surface2, border: `1px solid ${t.border}` }}
      />
      <span className="size-4 rounded-full" style={{ background: t.cyan }} />
      <span className="size-4 rounded-full" style={{ background: t.magenta }} />
    </span>
  );
}

/**
 * Theme choice for the whole site. Picking a card previews it immediately on every part of the
 * page; it is kept only when the profile is saved (leaving the page reverts to the saved theme).
 */
export function ThemePicker({ saved, selected }: { saved: string; selected: string }) {
  const [choice, setChoice] = useState(selected);
  useEffect(() => {
    apply(choice);
    return () => apply(saved);
  }, [choice, saved]);
  return (
    <fieldset className="mb-4">
      <legend className="mb-1 font-mono text-xs tracking-widest text-muted uppercase">Site theme</legend>
      <p className="mb-2 text-sm text-muted">
        Applies to every page when you&apos;re logged in. Tap one to preview it, then save your profile.
      </p>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
        {THEMES.map((t) => (
          <label
            key={t.value}
            className="flex min-h-11 cursor-pointer flex-col gap-1.5 rounded border border-border p-2 has-[:checked]:border-cyan has-[:checked]:bg-surface-2 has-[:focus-visible]:outline has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-cyan"
          >
            <Swatch theme={t.value} />
            <span className="flex items-center gap-2">
              <input
                type="radio"
                name="theme"
                value={t.value}
                checked={choice === t.value}
                onChange={() => setChoice(t.value)}
                className="accent-cyan"
              />
              <span className="font-semibold">{t.label}</span>
            </span>
            <span className="text-xs text-muted">{t.blurb}</span>
          </label>
        ))}
      </div>
    </fieldset>
  );
}
