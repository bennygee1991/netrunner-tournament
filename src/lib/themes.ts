/**
 * Site themes a player can pick on their Account page. The choice is saved on the account and
 * applied to every page through `data-theme` on <html> (see src/app/globals.css, which holds the
 * colours). "system" follows the device's dark/light setting.
 *
 * The colour tokens below mirror globals.css so a unit test can check WCAG AA contrast for every
 * theme; keep the two in step (the test also compares them).
 */
export const THEMES = [
  {
    value: "system",
    label: "Match my device",
    blurb: "Classic dark or light, following your device",
    scheme: "auto",
  },
  { value: "dark", label: "Classic dark", blurb: "The original cyan and magenta cyberpunk", scheme: "dark" },
  { value: "light", label: "Classic light", blurb: "Clean and bright for daytime", scheme: "light" },
  {
    value: "synthwave",
    label: "Synthwave",
    blurb: "Purple night, pink and cyan, a sunset grid",
    scheme: "dark",
  },
  { value: "neon", label: "Neon", blurb: "Pitch black with electric lime and hot pink", scheme: "dark" },
  { value: "cyberpunk", label: "Cyberpunk", blurb: "Night City yellow on gritty charcoal", scheme: "dark" },
  { value: "matrix", label: "Matrix", blurb: "Green phosphor terminal", scheme: "dark" },
  { value: "vaporwave", label: "Vaporwave", blurb: "Soft pastel dreamscape (light)", scheme: "light" },
  { value: "ember", label: "Ember", blurb: "Glowing orange and red on dark coal", scheme: "dark" },
  { value: "ocean", label: "Deep sea", blurb: "Midnight blue with bioluminescent teal", scheme: "dark" },
  { value: "amber", label: "Amber terminal", blurb: "Retro monochrome amber CRT", scheme: "dark" },
] as const;

export type ThemeValue = (typeof THEMES)[number]["value"];
export const THEME_VALUES = THEMES.map((t) => t.value) as [ThemeValue, ...ThemeValue[]];

export function isTheme(v: unknown): v is ThemeValue {
  return typeof v === "string" && (THEME_VALUES as string[]).includes(v);
}

/** Browser chrome colour (address bar) per theme; "system" is handled by media queries. */
export const THEME_COLOR: Record<Exclude<ThemeValue, "system">, string> = {
  dark: "#07090f",
  light: "#f5f7fb",
  synthwave: "#140b2e",
  neon: "#000000",
  cyberpunk: "#0c0b0a",
  matrix: "#000a03",
  vaporwave: "#f6efff",
  ember: "#120806",
  ocean: "#041320",
  amber: "#0a0600",
};

/** Colour tokens per theme (must match globals.css). Used by the contrast test. */
export const THEME_TOKENS: Record<
  Exclude<ThemeValue, "system">,
  {
    bg: string;
    surface: string;
    surface2: string;
    border: string;
    fg: string;
    muted: string;
    cyan: string;
    magenta: string;
    accentFg: string;
    ok: string;
    warn: string;
    danger: string;
  }
> = {
  dark: {
    bg: "#07090f",
    surface: "#0e1320",
    surface2: "#151c2e",
    border: "#22304d",
    fg: "#e6edf7",
    muted: "#8b9ab3",
    cyan: "#22e3ff",
    magenta: "#ff2bd6",
    accentFg: "#04121a",
    ok: "#3ee08f",
    warn: "#ffc94a",
    danger: "#ff4d6d",
  },
  light: {
    bg: "#f5f7fb",
    surface: "#ffffff",
    surface2: "#eef2f8",
    border: "#c9d3e3",
    fg: "#0d1526",
    muted: "#4f5d75",
    cyan: "#00748c",
    magenta: "#b0108f",
    accentFg: "#ffffff",
    ok: "#137a49",
    warn: "#8a5a00",
    danger: "#c0213f",
  },
  synthwave: {
    bg: "#140b2e",
    surface: "#1d1142",
    surface2: "#281859",
    border: "#4a2f8f",
    fg: "#f4eaff",
    muted: "#b3a0e0",
    cyan: "#2de2ff",
    magenta: "#ff4fd8",
    accentFg: "#140b2e",
    ok: "#5cf0a8",
    warn: "#ffd45e",
    danger: "#ff6b8b",
  },
  neon: {
    bg: "#000000",
    surface: "#0a0a0f",
    surface2: "#12121a",
    border: "#2b2b3d",
    fg: "#f2fff6",
    muted: "#9aa6a0",
    cyan: "#b6ff00",
    magenta: "#ff2d95",
    accentFg: "#000000",
    ok: "#39ff88",
    warn: "#ffe14a",
    danger: "#ff5470",
  },
  cyberpunk: {
    bg: "#0c0b0a",
    surface: "#161411",
    surface2: "#201d18",
    border: "#4a4220",
    fg: "#fff6d6",
    muted: "#b5a977",
    cyan: "#fcee0a",
    magenta: "#ff3c78",
    accentFg: "#0c0b0a",
    ok: "#4ee89a",
    warn: "#ffb347",
    danger: "#ff5a5a",
  },
  matrix: {
    bg: "#000a03",
    surface: "#031508",
    surface2: "#06200d",
    border: "#0f4a22",
    fg: "#c9ffd8",
    muted: "#6fc58a",
    cyan: "#2dff6e",
    magenta: "#b6ff3d",
    accentFg: "#000a03",
    ok: "#4dff9a",
    warn: "#e6ff4a",
    danger: "#ff6b6b",
  },
  vaporwave: {
    bg: "#f6efff",
    surface: "#ffffff",
    surface2: "#efe4ff",
    border: "#cdb6f2",
    fg: "#2a1650",
    muted: "#5d4a86",
    cyan: "#006b7a",
    magenta: "#b0127f",
    accentFg: "#ffffff",
    ok: "#0a6b43",
    warn: "#8a5200",
    danger: "#c01f45",
  },
  ember: {
    bg: "#120806",
    surface: "#1c0f0b",
    surface2: "#27150f",
    border: "#5a2e1c",
    fg: "#ffeee2",
    muted: "#c19d88",
    cyan: "#ff9a3c",
    magenta: "#ff4b3a",
    accentFg: "#120806",
    ok: "#6be08f",
    warn: "#ffd04a",
    danger: "#ff6b6b",
  },
  ocean: {
    bg: "#041320",
    surface: "#08203a",
    surface2: "#0d2d4d",
    border: "#1c4f7a",
    fg: "#e2f6ff",
    muted: "#85b5cf",
    cyan: "#3df5d5",
    magenta: "#6aa8ff",
    accentFg: "#041320",
    ok: "#5cf0a0",
    warn: "#ffd45e",
    danger: "#ff7a8c",
  },
  amber: {
    bg: "#0a0600",
    surface: "#140c00",
    surface2: "#1e1200",
    border: "#4d3200",
    fg: "#ffd98a",
    muted: "#c9984a",
    cyan: "#ffb000",
    magenta: "#ff7a1a",
    accentFg: "#0a0600",
    ok: "#a8e060",
    warn: "#ffe066",
    danger: "#ff6a4a",
  },
};
