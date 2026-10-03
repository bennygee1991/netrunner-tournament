import { expect, test } from "@playwright/test";
import { PASSWORD, loginOk, register, uniqueName } from "./fixtures";

// Runs after event-flow.spec.ts, which finishes "Kickoff Clash" (Event 1 of the E2E season).

test("leaderboards show the month and season boards", async ({ page }) => {
  await page.goto("/leaderboards");
  await expect(page.getByRole("link", { name: "Month 1" })).toHaveAttribute("aria-current", "page");
  const board = page.getByRole("table", { name: "Month 1 leaderboard" });
  await expect(board).toBeVisible();
  await expect(board.getByRole("columnheader", { name: "E1" })).toBeVisible();
  await expect(board.getByRole("cell", { name: "10" }).first()).toBeVisible();
  await expect(page.getByRole("list", { name: "Top 3" })).toBeVisible();

  await page.getByRole("link", { name: "Season" }).click();
  const season = page.getByRole("table", { name: "Season leaderboard" });
  await expect(season.getByRole("columnheader", { name: "M1" })).toBeVisible();
  await expect(season.getByRole("columnheader", { name: "M2" })).toBeVisible();

  await page.getByRole("link", { name: "Past" }).click();
  await expect(page.getByRole("heading", { name: "Hall of fame" })).toBeVisible();
});

test("a player's profile shows trophies and event history", async ({ page }) => {
  await page.goto("/leaderboards");
  const board = page.getByRole("table", { name: "Month 1 leaderboard" });
  const alice = board.getByRole("link", { name: /^Alice / });
  const name = (await alice.textContent())!.trim();
  await alice.click();
  await expect(page.getByRole("heading", { level: 1, name })).toBeVisible();
  await expect(page.getByRole("list", { name: "Trophies" })).toContainText("Jacked in");
  // Placings depend on the random pairings, so only check that the event is listed with a placing.
  const history = page
    .locator("section")
    .filter({ has: page.getByRole("heading", { name: "Event history" }) })
    .getByRole("listitem")
    .filter({ hasText: "Kickoff Clash" });
  await expect(history).toContainText(/Champion|Finalist|Top 4|Rank \d+/);
  await expect(history).toContainText(/\+\d+/);
});

test("players edit a public bio", async ({ page }) => {
  const name = uniqueName("Bio");
  await register(page, name, PASSWORD);
  await page.getByLabel("Bio (public, optional)").fill("Shaper main. Loves Stimhack.");
  await page.getByRole("button", { name: "Save profile" }).click();
  await expect(page.getByText("Saved.")).toBeVisible();
  await page.getByRole("link", { name: "View public profile" }).click();
  await expect(page.getByText("Shaper main. Loves Stimhack.")).toBeVisible();
  await expect(page.getByText("No trophies yet.")).toBeVisible();
});

test("unknown profiles are 404", async ({ page }) => {
  const res = await page.goto("/players/No%20Such%20Runner");
  expect(res?.status()).toBe(404);
});

test("the rules page is generated from the engine rules", async ({ page }) => {
  await page.goto("/rules");
  await expect(page.getByRole("heading", { name: "Who plays Corp or Runner?" })).toBeVisible();
  await expect(page.getByText("Each game: win 3 · tie 1 · loss 0.")).toBeVisible();
  await expect(page.getByText(/champion 10 · finalist 7 · top 4 5 · top 8 3/)).toBeVisible();
  await expect(page.getByText(/higher seed advances/)).toBeVisible();
  await page.getByRole("link", { name: "Trophies" }).click();
  await expect(page).toHaveURL(/#trophies$/);
});

test("signed-in players see their results on the account page", async ({ page }) => {
  await page.goto("/leaderboards");
  const alice = (await page
    .getByRole("table", { name: "Month 1 leaderboard" })
    .getByRole("link", { name: /^Alice / })
    .textContent())!.trim();
  await loginOk(page, alice);
  await page.goto("/account");
  const results = page
    .getByRole("region", { name: "My results" })
    .or(page.locator("section").filter({ hasText: "My results" }));
  await expect(results.getByText("Kickoff Clash")).toBeVisible();
  await expect(results.getByText(/^\+\d+$/)).toBeVisible();
});
