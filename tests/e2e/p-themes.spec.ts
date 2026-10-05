import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";
import { register, uniqueName } from "./fixtures";

// Every selectable site theme must keep every page readable (WCAG 2.1 AA, including colour
// contrast). Runs after event-flow (so there is an event with a flowchart) and before repair.
test.setTimeout(240_000);

const THEMES = [
  "synthwave",
  "neon",
  "cyberpunk",
  "matrix",
  "vaporwave",
  "ember",
  "ocean",
  "amber",
  "cityscape",
  "tokyo",
  "chrome",
  "bloodmoon",
  "hologram",
  "candy",
];

test("every theme passes accessibility checks on the main pages", async ({ page }) => {
  await register(page, uniqueName("Looks"));
  await page.goto("/events");
  const events = await page
    .locator('a[href^="/events/"]')
    .evaluateAll((as) => as.map((a) => a.getAttribute("href")!));
  const finished = events[0]!;
  const paths = ["/", finished, "/leaderboards?board=season", "/trophies", "/rules", "/players", "/account"];

  for (const theme of THEMES) {
    for (const path of paths) {
      await page.goto(path);
      // Same effect as the saved preference: data-theme on <html>.
      await page.evaluate((t) => document.documentElement.setAttribute("data-theme", t), theme);
      const results = await new AxeBuilder({ page })
        .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"])
        .analyze();
      const summary = results.violations.map(
        (v) =>
          `${v.id}: ${v.help} (${v.nodes
            .map((n) => n.target.join(" "))
            .slice(0, 3)
            .join(" | ")})`,
      );
      expect(summary, `${theme} ${path}`).toEqual([]);
    }
  }
});
