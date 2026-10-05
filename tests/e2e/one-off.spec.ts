import { expect, test } from "@playwright/test";
import { E2E_ADMIN, loginOk } from "./fixtures";

// Runs after event-flow/finale (season exists). Leaves one finished one-off for the later
// accessibility scans and deletes a second one.
test.describe.configure({ mode: "serial" });

test("organizer creates a double-sided one-off, runs it with the clock, and it gives no league points", async ({
  page,
}) => {
  await loginOk(page, E2E_ADMIN.runnerName, E2E_ADMIN.password);
  await page.goto("/admin/events");
  await page.getByLabel("Event name").fill("Midnight Masters");
  await page.getByRole("radio", { name: /^Double-sided/ }).check();
  await page.getByLabel("Swiss rounds").fill("1");
  await expect(page.getByRole("radio", { name: /^None/ })).toBeChecked();
  await page.getByRole("button", { name: "Create one-off event" }).click();
  await expect(page.getByText(/One-off event created/)).toBeVisible();
  await expect(page.getByText("One-off event · run event")).toBeVisible();
  const adminUrl = page.url().split("?")[0]!;

  for (const guest of ["Night One", "Night Two"]) {
    await page.getByLabel("Add player").fill(guest);
    await page.getByRole("button", { name: "Add", exact: true }).click();
    await expect(page.getByText(`Added ${guest} (walk-in guest).`)).toBeVisible();
  }
  await page.getByRole("button", { name: "Start Swiss" }).click();

  // Round clock: 65 minutes double-sided, started by the organizer.
  const timer = page.getByRole("timer").first();
  await expect(timer).toHaveAccessibleName(/Round 1 clock: 65:00 not started/);
  await page.getByRole("button", { name: "Start clock" }).click();
  await expect(timer).toHaveAccessibleName(/running/);
  await page.getByRole("button", { name: "Pause" }).click();
  await expect(timer).toHaveAccessibleName(/paused/);
  await page.getByRole("button", { name: "+1 min" }).click();
  await expect(timer).toHaveAccessibleName(/65:\d\d paused|66:00 paused/);

  // Players see the clock in the flowchart.
  const publicUrl = adminUrl.replace("/admin", "");
  await page.goto(publicUrl);
  await expect(page.getByText(/One-off event$/).first()).toBeVisible();
  await expect(page.getByText("One-off · no league points")).toBeVisible();
  await expect(
    page
      .getByRole("region", { name: /Tournament flowchart/ })
      .getByRole("timer")
      .first(),
  ).toBeVisible();

  await page.goto(adminUrl);
  const m = page.getByTestId("match-swiss-0-0");
  for (const game of [1, 2]) {
    const row = m.locator("form").filter({ has: page.locator(`input[name="game"][value="${game}"]`) });
    await row.getByRole("button").first().click();
    await expect(row.getByRole("button").first()).toHaveAttribute("aria-pressed", "true");
  }
  await page.getByRole("button", { name: "Finish event" }).click();
  await expect(page.getByText(/Results and trophies are on the players' profiles/)).toBeVisible();

  await page.goto(publicUrl);
  await expect(page.getByRole("table", { name: "Final placings" })).toBeVisible();
  await expect(page.getByRole("columnheader", { name: "League pts" })).toHaveCount(0);
  await page.goto("/events");
  await expect(page.getByRole("heading", { name: /One-off events/ })).toBeVisible();
  await expect(page.getByRole("link", { name: /Midnight Masters/ })).toBeVisible();
  await page.goto("/trophies");
  await expect(page.getByText("🎪 Midnight Masters")).toBeVisible();
});

test("a one-off event can be deleted with a two-tap button", async ({ page }) => {
  await loginOk(page, E2E_ADMIN.runnerName, E2E_ADMIN.password);
  await page.goto("/admin/events");
  await page.getByLabel("Event name").fill("Cancelled Cup");
  await page.getByRole("button", { name: "Create one-off event" }).click();
  await expect(page.getByText(/One-off event created/)).toBeVisible();
  // First tap only arms the button; nothing is deleted yet.
  await page.getByRole("button", { name: "Delete event" }).click();
  await expect(page.getByRole("button", { name: "Tap again to confirm" })).toBeVisible();
  await expect(page).not.toHaveURL(/notice=event-deleted/);
  await page.getByRole("button", { name: "Tap again to confirm" }).click();
  await expect(page).toHaveURL(/notice=event-deleted/);
  await expect(page.getByText("Event deleted.")).toBeVisible();
  await expect(page.getByRole("link", { name: /Cancelled Cup/ })).toHaveCount(0);
});
