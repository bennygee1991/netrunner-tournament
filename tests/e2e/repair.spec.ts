import { expect, test, type Page } from "@playwright/test";
import { E2E_ADMIN, loginOk } from "./fixtures";

test.describe.configure({ mode: "serial" });

let adminEventUrl = "";
const GUESTS = ["Rep Alpha", "Rep Bravo", "Rep Charlie", "Rep Delta", "Rep Echo"];

async function reportRound(page: Page, round: number, pick: "first" | "last" = "first") {
  const matches = page.locator(`[data-testid^="match-swiss-${round}-"]`);
  const count = await matches.count();
  for (let i = 0; i < count; i++) {
    const m = page.getByTestId(`match-swiss-${round}-${i}`);
    if ((await m.count()) === 0) continue;
    const btn = pick === "first" ? m.getByRole("button").first() : m.getByRole("button").last();
    if ((await btn.getAttribute("aria-pressed")) === "true") continue;
    await btn.click();
    await expect(btn).toHaveAttribute("aria-pressed", "true");
  }
}

async function tapTwice(page: Page, name: string | RegExp) {
  await page.getByRole("button", { name }).click();
  await page.getByRole("button", { name: "Tap again to confirm" }).click();
}

test("set up an event to repair", async ({ page }) => {
  await loginOk(page, E2E_ADMIN.runnerName, E2E_ADMIN.password);
  await page.goto("/admin/season");
  if (await page.getByRole("button", { name: "Create season" }).isVisible()) {
    await page.getByLabel("Season name").fill("Repair Season");
    await page.getByLabel("First event date").fill("2030-02-02");
    await page.getByRole("button", { name: "Create season" }).click();
  }
  await page.getByRole("link", { name: /Event 3/ }).click();
  await page.waitForURL(/\/admin\/events\//);
  adminEventUrl = page.url();
  for (const g of GUESTS) {
    await page.getByLabel("Add player").fill(g);
    await page.getByRole("button", { name: "Add", exact: true }).click();
    await expect(page.getByText(`Added ${g} (walk-in guest).`)).toBeVisible();
  }
  await page.getByLabel("Swiss rounds").fill("3");
  await page.getByRole("radio", { name: /^None/ }).check();
  await page.getByRole("button", { name: "Save event" }).click();
  await expect(page.getByText("Event saved.")).toBeVisible();
  await page.getByRole("button", { name: "Start Swiss" }).click();
  await expect(page.getByText("Round 1 · in progress")).toBeVisible();
});

test("restart, drop, repair and undo", async ({ page }) => {
  await loginOk(page, E2E_ADMIN.runnerName, E2E_ADMIN.password);
  await page.goto(adminEventUrl);
  await reportRound(page, 0);
  await page.getByRole("button", { name: "Pair round 2" }).click();
  await expect(page.getByText("Round 2 · in progress")).toBeVisible();

  // Drop a player, then restart the round: they are no longer paired.
  await page.getByRole("button", { name: "Drop Rep Alpha" }).click();
  await expect(page.getByRole("button", { name: "Re-add Rep Alpha" })).toBeVisible();
  await tapTwice(page, "Restart round 2");
  await expect(page.getByText("Round re-paired.")).toBeVisible();
  await expect(page.locator('[data-testid^="match-swiss-1-"]').filter({ hasText: "Rep Alpha" })).toHaveCount(
    0,
  );

  // Undo the drop.
  await page.getByRole("button", { name: "Re-add Rep Alpha" }).click();
  await expect(page.getByRole("button", { name: "Drop Rep Alpha" })).toBeVisible();

  // Repair a round 1 result while round 2 is running.
  await reportRound(page, 1);
  await page.getByRole("link", { name: "Repair an earlier round's results" }).click();
  await expect(page.getByText("Repair mode is on:")).toBeVisible();
  const r1 = page.getByTestId("match-swiss-0-0");
  await r1.getByRole("button").last().click();
  await expect(r1.getByRole("button").last()).toHaveAttribute("aria-pressed", "true");
  await page.getByRole("link", { name: "Turn off" }).click();

  // Undo round 2 entirely.
  await tapTwice(page, "Undo round 2");
  await expect(page.getByText("Round undone.")).toBeVisible();
  await expect(page.getByRole("button", { name: "Pair round 2" })).toBeVisible();
});

test("finish, reopen and reset the event", async ({ page }) => {
  await loginOk(page, E2E_ADMIN.runnerName, E2E_ADMIN.password);
  await page.goto(adminEventUrl);
  for (const r of [2, 3]) {
    await page.getByRole("button", { name: `Pair round ${r}` }).click();
    await expect(page.getByText(`Round ${r} · in progress`)).toBeVisible();
    await reportRound(page, r - 1);
  }
  await page.getByRole("button", { name: "Finish event" }).click();
  await expect(page.getByText("Event finished. Points are on the leaderboards.")).toBeVisible();

  await tapTwice(page, "Reopen event");
  await expect(page.getByText(/Event reopened/)).toBeVisible();
  await expect(page.getByRole("button", { name: "Finish event" })).toBeVisible();
  await expect(page.getByText("Round 3 · all reported")).toBeVisible();

  const reset = page.getByRole("button", { name: "Reset event" });
  await expect(reset).toBeDisabled();
  await page.getByLabel('Type "Event 3" to reset this event').fill("Event 3");
  await reset.click();
  await expect(page.getByText("Event reset to sign-up.")).toBeVisible();
  await expect(page.getByRole("button", { name: "Start Swiss" })).toBeVisible();
  await expect(page.getByText("Entrants (5)")).toBeVisible();
});

test("the audit log records the repairs", async ({ page }) => {
  await loginOk(page, E2E_ADMIN.runnerName, E2E_ADMIN.password);
  await page.goto("/admin/audit");
  for (const label of [
    "Reset event",
    "Reopened event",
    "Undid round",
    "Restarted round",
    "Dropped player",
    "Re-added player",
  ]) {
    await expect(page.getByText(label, { exact: true }).first()).toBeVisible();
  }
  await page.getByLabel("Filter by action or admin").fill("event.drop");
  await page.getByRole("button", { name: "Filter" }).click();
  await expect(page.getByText("Dropped player", { exact: true })).toBeVisible();
  await expect(page.getByText("player: Rep Alpha")).toBeVisible();
});

test("archive the season, then reset everything", async ({ page }) => {
  await loginOk(page, E2E_ADMIN.runnerName, E2E_ADMIN.password);
  await page.goto("/admin/season");
  const seasonName = (await page.getByRole("heading", { level: 1 }).textContent())!.trim();
  // Heading is styled uppercase in CSS only; the DOM keeps the real casing.
  const archive = page.getByRole("button", { name: "Archive season & reset" });
  await expect(archive).toBeDisabled();
  await page.getByLabel(`Type "${seasonName}" to archive and reset`).fill(seasonName);
  await archive.click();
  await expect(page.getByText("Season archived to Past seasons.")).toBeVisible();
  await page.goto("/leaderboards?board=past");
  await expect(page.getByRole("heading", { name: seasonName })).toBeVisible();
  await expect(page.getByText("Season champion:")).toBeVisible();
  await page.goto("/admin/season");
  await expect(page.getByRole("button", { name: "Create season" })).toBeVisible();

  await page.getByLabel("Type RESET to unlock").fill("RESET");
  await page.getByRole("button", { name: "Wipe all data" }).click();
  await expect(page.getByText("Everything was reset.")).toBeVisible();
});

test("admin downloads a backup", async ({ page }) => {
  await loginOk(page, E2E_ADMIN.runnerName, E2E_ADMIN.password);
  await page.goto("/admin");
  const download = page.waitForEvent("download");
  await page.getByRole("button", { name: "Download backup" }).click();
  const file = await download;
  expect(file.suggestedFilename()).toMatch(/^circuit-backup-\d{4}-\d{2}-\d{2}\.json$/);
  const text = await (await import("node:fs/promises")).readFile((await file.path())!, "utf8");
  const json = JSON.parse(text);
  expect(json.format).toBe("netrunner-circuit-backup");
  expect(json.counts.user).toBeGreaterThan(0);
  expect(text).not.toContain("nc_session");
});

test("players cannot download backups", async ({ page, request }) => {
  const res = await request.post("/admin/backup", {
    headers: { origin: "http://localhost:3100" },
    maxRedirects: 0,
  });
  expect([303, 307, 308, 404]).toContain(res.status());
  expect(await res.text()).not.toContain("netrunner-circuit-backup");
  void page;
});
