import { expect, test, type Page } from "@playwright/test";
import { E2E_ADMIN, loginOk, logout, register, uniqueName } from "./fixtures";

test.describe.configure({ mode: "serial" });

const playerA = uniqueName("Alice");
const playerB = uniqueName("Bob");
let eventUrl = "";

async function reportAllA(page: Page, phase: "swiss" | "cut", round: number) {
  // Tap player A's button in every open match of one round. Once a cut round is complete its
  // entry buttons disappear (the next round is paired), which also counts as done.
  const matches = page.locator(`[data-testid^="match-${phase}-${round}-"]`);
  const count = await matches.count();
  expect(count).toBeGreaterThan(0);
  for (let i = 0; i < count; i++) {
    const m = page.getByTestId(`match-${phase}-${round}-${i}`);
    if ((await m.count()) === 0) continue; // bye
    const a = m.getByRole("button").first();
    if ((await a.getAttribute("aria-pressed")) === "true") continue;
    await a.click();
    await expect(async () => {
      const gone = (await m.count()) === 0;
      const pressed = !gone && (await m.getByRole("button").first().getAttribute("aria-pressed")) === "true";
      expect(gone || pressed).toBe(true);
    }).toPass();
  }
}

test("admin creates a season with 4 events", async ({ page }) => {
  await loginOk(page, E2E_ADMIN.runnerName, E2E_ADMIN.password);
  await page.goto("/admin/season");
  await page.getByLabel("Season name").fill("E2E Season");
  await page.getByLabel("First event date").fill("2030-01-05");
  await page.getByRole("button", { name: "Create season" }).click();
  await expect(page.getByRole("heading", { name: "E2E Season" })).toBeVisible();
  await expect(page.getByRole("link", { name: /Event 1/ })).toBeVisible();
  await expect(page.getByRole("link", { name: /Event 4/ })).toBeVisible();
});

test("visitors see the next event and a register call to action", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByText("Next up")).toBeVisible();
  await expect(page.getByRole("heading", { name: "Event 1" }).first()).toBeVisible();
  await expect(page.getByRole("heading", { name: "Register to play" })).toBeVisible();
});

test("players register and sign up from the home page", async ({ page }) => {
  for (const name of [playerA, playerB]) {
    await register(page, name);
    await page.goto("/");
    await page.getByRole("button", { name: "Sign up for Event 1" }).click();
    await expect(page.getByText("You're signed up for Event 1.")).toBeVisible();
    await expect(page.getByRole("list", { name: "Signed up for Event 1" })).toContainText(name);
    await logout(page);
  }
  // Withdraw and sign up again works.
  await loginOk(page, playerB);
  await page.goto("/");
  await page.getByRole("button", { name: "Event 1: Withdraw" }).click();
  await expect(page.getByText("You've withdrawn from Event 1.")).toBeVisible();
  await page.getByRole("button", { name: "Sign up for Event 1" }).click();
  await expect(page.getByText("You're signed up for Event 1.")).toBeVisible();
  await page.goto("/account");
  await expect(page.getByRole("link", { name: "Event 1" })).toBeVisible();
});

test("admin approves sign-ups, adds walk-ins and sets up the event", async ({ page }) => {
  await loginOk(page, E2E_ADMIN.runnerName, E2E_ADMIN.password);
  await page.goto("/admin/season");
  await page.getByRole("link", { name: /Event 1/ }).click();
  await expect(page.getByText(`Pending sign-ups (2)`)).toBeVisible();
  await page.getByRole("button", { name: "Approve all (2)" }).click();
  await expect(page.getByText("Entrants (2)")).toBeVisible();

  for (const guest of ["Walk In One", "Walk In Two", "Walk In Three"]) {
    await page.getByLabel("Add player").fill(guest);
    await page.getByRole("button", { name: "Add", exact: true }).click();
    await expect(page.getByText(`Added ${guest} (walk-in guest).`)).toBeVisible();
  }
  await expect(page.getByText("Entrants (5)")).toBeVisible();

  await page.getByLabel("Event name").fill("Kickoff Clash");
  await page.getByLabel("Swiss rounds").fill("2");
  await page.getByLabel("Top cut").selectOption("4");
  await page.getByRole("button", { name: "Save event" }).click();
  await expect(page.getByText("Event saved.")).toBeVisible();
  await expect(page.getByRole("heading", { name: "Kickoff Clash" })).toBeVisible();
  eventUrl = page.url().replace("/admin", "");
});

test("admin runs Swiss and the cut to a champion", async ({ page }) => {
  await loginOk(page, E2E_ADMIN.runnerName, E2E_ADMIN.password);
  await page.goto(eventUrl.replace("/events", "/admin/events"));

  await page.getByRole("button", { name: "Start Swiss" }).click();
  await expect(page.getByText("Round 1 · in progress")).toBeVisible();
  await expect(page.getByText(/BYE · \+3/)).toBeVisible();
  await reportAllA(page, "swiss", 0);
  await expect(page.getByText("Round 1 · all reported")).toBeVisible();

  await page.getByRole("button", { name: "Pair round 2" }).click();
  await expect(page.getByText("Round 2 · in progress")).toBeVisible();
  await reportAllA(page, "swiss", 1);

  await page.getByRole("button", { name: "Start top 4 cut" }).click();
  await expect(page.getByRole("heading", { name: "Semifinals" })).toBeVisible();
  await reportAllA(page, "cut", 0);
  await expect(page.getByRole("heading", { name: "Final", exact: true })).toBeVisible();
  await reportAllA(page, "cut", 1);
  await expect(page.getByText("Event finished. Points are on the leaderboards.")).toBeVisible();
  await expect(page.getByRole("cell", { name: "Champion" })).toBeVisible();
});

test("the public event page shows results, bracket and standings", async ({ page }) => {
  await page.goto(eventUrl);
  await expect(page.getByRole("heading", { name: "Kickoff Clash" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Final results" })).toBeVisible();
  await expect(page.getByRole("cell", { name: "Champion" })).toBeVisible();
  await expect(page.getByRole("cell", { name: "+10" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Top cut" })).toBeVisible();
  await expect(page.getByRole("table", { name: "Swiss standings" })).toBeVisible();
  await page.goto("/events");
  await expect(page.getByRole("link", { name: /Kickoff Clash/ })).toContainText("Done");
});

test("players cannot run events", async ({ page }) => {
  await loginOk(page, playerA);
  const res = await page.goto(eventUrl.replace("/events", "/admin/events"));
  expect(res?.status()).toBe(404);
});
