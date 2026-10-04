import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";
import { E2E_ADMIN, loginOk } from "./fixtures";

// Runs after event-flow/public-pages (which create players, a season and a finished event) and
// before repair.spec.ts (which wipes everything at the end), so pages have real content.
test.setTimeout(180_000);

async function audit(page: Page, path: string) {
  await page.goto(path);
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
  expect(summary, `${path} accessibility violations`).toEqual([]);
}

for (const scheme of ["dark", "light"] as const) {
  test.describe(`${scheme} theme`, () => {
    test.use({ colorScheme: scheme });

    test("public pages have no accessibility violations", async ({ page }) => {
      for (const path of [
        "/",
        "/register",
        "/login",
        "/events",
        "/leaderboards",
        "/leaderboards?board=past",
        "/rules",
      ]) {
        await audit(page, path);
      }
      // Every event page of the current season, plus profiles linked from the boards.
      await page.goto("/events");
      const events = await page
        .locator('a[href^="/events/"]')
        .evaluateAll((as) => as.map((a) => a.getAttribute("href")!));
      expect(events.length).toBeGreaterThan(0);
      for (const href of events) {
        await audit(page, href);
        await audit(page, `${href}?view=list`);
      }
      await page.goto("/leaderboards?board=season");
      const profiles = page.locator('a[href^="/players/"]');
      expect(await profiles.count()).toBeGreaterThan(0);
      await audit(page, (await profiles.first().getAttribute("href"))!);
    });

    test("admin pages have no accessibility violations", async ({ page }) => {
      await loginOk(page, E2E_ADMIN.runnerName, E2E_ADMIN.password);
      for (const path of [
        "/account",
        "/account/password",
        "/admin",
        "/admin/season",
        "/admin/events",
        "/admin/players",
        "/admin/audit",
      ]) {
        await audit(page, path);
      }
      await page.goto("/admin/season");
      const events = await page
        .locator('a[href^="/admin/events/"]')
        .evaluateAll((as) => as.map((a) => a.getAttribute("href")!));
      for (const href of events) {
        await audit(page, href);
        await audit(page, `${href}?repair=1`);
      }
    });
  });
}
