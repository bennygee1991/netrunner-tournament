import { expect, test } from "@playwright/test";
import { E2E_ADMIN, loginOk, logout, register, uniqueName } from "./fixtures";

// Runs after repair.spec.ts (which resets everything), so it creates its own season.
test.describe.configure({ mode: "serial" });

const p1 = uniqueName("Rep One");
const p2 = uniqueName("Rep Two");
let eventPath = "";

test("organizer starts an event with two account players", async ({ page }) => {
  for (const name of [p1, p2]) {
    await register(page, name);
    await logout(page);
  }
  await loginOk(page, E2E_ADMIN.runnerName, E2E_ADMIN.password);
  await page.goto("/admin/season");
  if (await page.getByRole("button", { name: "Create season" }).isVisible()) {
    await page.getByLabel("Season name").fill("Report Season");
    await page.getByLabel("First event date").fill("2031-03-01");
    await page.getByRole("button", { name: "Create season" }).click();
  }
  await page.getByRole("link", { name: /Event 1/ }).click();
  await page.waitForURL(/\/admin\/events\//);
  eventPath = new URL(page.url()).pathname.replace("/admin", "");
  for (const name of [p1, p2]) {
    await page.getByLabel("Add player").fill(name);
    await page.getByRole("button", { name: "Add", exact: true }).click();
    await expect(page.getByText(`Added ${name}.`)).toBeVisible();
  }
  await page.getByLabel("Swiss rounds").fill("1");
  await page.getByRole("radio", { name: /^None/ }).check();
  await page.getByRole("button", { name: "Save event" }).click();
  await expect(page.getByText("Event saved.")).toBeVisible();
  await page.getByRole("button", { name: "Start Swiss" }).click();
  await expect(page.getByText("Round 1 · in progress")).toBeVisible();
});

test("both players report from the event page", async ({ page }) => {
  await loginOk(page, p1);
  await page.goto(eventPath);
  await expect(page.getByRole("heading", { name: "Your match" })).toBeVisible();
  await expect(page.getByText(`vs ${p2}`)).toBeVisible();
  await page.getByRole("button", { name: "I won" }).click();
  await expect(page.getByText("You reported: i won.")).toBeVisible();
  const chart = page.getByRole("region", { name: /Tournament flowchart/ });
  await expect(chart.getByText("awaiting approval", { exact: true })).toBeVisible();
  await page.goto(`${eventPath}?view=list`);
  await expect(page.getByText(/awaiting organizer approval/)).toBeVisible();
  await logout(page);

  await loginOk(page, p2);
  await page.goto(eventPath);
  await page.getByRole("button", { name: "I lost" }).click();
  await expect(page.getByText(/You reported: i lost\. Your opponent reported too\./)).toBeVisible();
});

test("the organizer approves agreed results in one tap", async ({ page }) => {
  await loginOk(page, E2E_ADMIN.runnerName, E2E_ADMIN.password);
  await page.goto(`/admin${eventPath}`);
  await expect(page.getByText(new RegExp(`Reported: .*${p1} says ${p1} won`))).toBeVisible();
  await page.getByRole("button", { name: "Approve all agreed results (1)" }).click();
  await expect(page.getByText("Round 1 · all reported")).toBeVisible();
  await expect(page.getByRole("button", { name: "Finish event" })).toBeVisible();

  await page.goto("/admin/audit?q=approve_reports");
  await expect(page.getByText("Approved reported results")).toBeVisible();
});
