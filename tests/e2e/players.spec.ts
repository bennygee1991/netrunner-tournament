import { expect, test } from "@playwright/test";
import { register, uniqueName } from "./fixtures";

test("players pick an avatar that shows on their profile and in the directory", async ({ page }) => {
  const name = uniqueName("Avatar");
  await register(page, name);
  await page.getByRole("radio", { name: "Ghost, magenta" }).check({ force: true });
  await page.getByRole("button", { name: "Save profile" }).click();
  await expect(page.getByText("Saved.")).toBeVisible();
  await page.reload();
  await expect(page.getByRole("radio", { name: "Ghost, magenta" })).toBeChecked();

  await page.goto(`/players?q=${encodeURIComponent(name)}`);
  const list = page.getByRole("list", { name: "Players" });
  await expect(list.getByRole("link", { name: new RegExp(name) })).toBeVisible();
  await expect(list.locator("svg")).toHaveCount(1);
  await list.getByRole("link", { name: new RegExp(name) }).click();
  await expect(page.getByRole("heading", { level: 1, name })).toBeVisible();
});

test("the players directory sorts and searches", async ({ page }) => {
  await page.goto("/players");
  await expect(page.getByRole("heading", { level: 1, name: "Players" })).toBeVisible();
  await page.getByRole("link", { name: "Most events" }).click();
  await expect(page.getByRole("link", { name: "Most events" })).toHaveAttribute("aria-current", "page");
  await page.getByLabel("Search runner names").fill("zzzz-nobody");
  await page.getByRole("button", { name: "Search" }).click();
  await expect(page.getByText("No players found.")).toBeVisible();
});

test("the hall of champions lists event champions and milestones", async ({ page }) => {
  // event-flow.spec.ts finished "Kickoff Clash" earlier in the run.
  await page.goto("/trophies");
  await expect(page.getByRole("heading", { level: 1, name: "Hall of champions" })).toBeVisible();
  await expect(page.getByText("⭐ Kickoff Clash")).toBeVisible();
  await expect(page.getByRole("list", { name: "Jacked in holders" })).toBeVisible();
  await page.goto("/leaderboards");
  await page.getByRole("link", { name: "Hall of champions" }).click();
  await expect(page).toHaveURL("/trophies");
});

test("bios are public but emails never appear on public pages", async ({ page }) => {
  const name = uniqueName("Bio");
  const email = `${name.toLowerCase().replace(/[^a-z0-9]/g, "")}@example.com`;
  const bio = "Shaper main. Will trade Sure Gamble for snacks.";
  await register(page, name);
  await page.getByLabel("Email (optional)").fill(email);
  await page.getByLabel("Bio (public, optional)").fill(bio);
  await page.getByRole("button", { name: "Save profile" }).click();
  await expect(page.getByText("Saved.")).toBeVisible();

  for (const path of [`/players?q=${encodeURIComponent(name)}`, `/players/${encodeURIComponent(name)}`]) {
    await page.goto(path);
    await expect(page.getByText(bio)).toBeVisible();
    expect(await page.content(), `${path} leaks the email`).not.toContain(email);
  }
  await expect(page.getByRole("heading", { level: 1, name })).toBeVisible();
  await expect(page.getByRole("heading", { name: /Trophy cabinet/i })).toBeVisible();
});
