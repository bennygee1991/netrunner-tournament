import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { THEME_COLOR, THEME_TOKENS, THEME_VALUES, THEMES } from "./themes";

function lum(hex: string) {
  const c = [1, 3, 5].map((i) => {
    const v = parseInt(hex.slice(i, i + 2), 16) / 255;
    return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * c[0]! + 0.7152 * c[1]! + 0.0722 * c[2]!;
}
const ratio = (a: string, b: string) => {
  const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p);
  return (x! + 0.05) / (y! + 0.05);
};

const css = readFileSync("src/app/globals.css", "utf8");
const names = Object.keys(THEME_TOKENS) as (keyof typeof THEME_TOKENS)[];

describe("site themes", () => {
  it("has a colour entry and a label for every selectable theme", () => {
    expect(new Set(THEME_VALUES).size).toBe(THEMES.length);
    for (const v of THEME_VALUES) if (v !== "system") expect(THEME_TOKENS[v]).toBeDefined();
    expect(Object.keys(THEME_COLOR).sort()).toEqual([...names].sort());
  });

  for (const name of names) {
    const t = THEME_TOKENS[name];
    it(`${name}: text and accents meet WCAG AA (4.5:1) on every surface`, () => {
      const fails: string[] = [];
      for (const bgName of ["bg", "surface", "surface2"] as const) {
        for (const fg of ["fg", "muted", "cyan", "magenta", "ok", "warn", "danger"] as const) {
          const r = ratio(t[fg], t[bgName]);
          if (r < 4.5) fails.push(`${fg} on ${bgName}: ${r.toFixed(2)}`);
        }
      }
      // Buttons: dark/light label on the accent fill, and on the danger hover fill.
      for (const fill of ["cyan", "danger"] as const) {
        const r = ratio(t.accentFg, t[fill]);
        if (r < 4.5) fails.push(`accentFg on ${fill}: ${r.toFixed(2)}`);
      }
      expect(fails).toEqual([]);
    });

    it(`${name}: globals.css defines the same colours`, () => {
      if (name === "dark") return; // :root defaults
      const block = css.match(new RegExp(`:root\\[data-theme="${name}"\\]\\s*\\{([^}]*)\\}`))?.[1];
      expect(block, `no CSS block for ${name}`).toBeDefined();
      const get = (k: string) => block!.match(new RegExp(`--${k}:\\s*(#[0-9a-fA-F]{6})`))?.[1]?.toLowerCase();
      expect(get("bg")).toBe(t.bg);
      expect(get("surface")).toBe(t.surface);
      expect(get("cyan")).toBe(t.cyan);
      expect(get("magenta")).toBe(t.magenta);
      expect(get("accent-fg")).toBe(t.accentFg);
    });
  }
});
