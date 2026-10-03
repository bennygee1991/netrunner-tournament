import { expect, test } from "@playwright/test";
import { E2E_ADMIN, loginOk, logout } from "./fixtures";

test.describe.configure({ mode: "serial" });

test("admin adds starter pages, edits and publishes the FAQ", async ({ page }) => {
  await loginOk(page, E2E_ADMIN.runnerName, E2E_ADMIN.password);
  await page.goto("/admin/guides");
  await page.getByRole("button", { name: "Add starter pages" }).click();
  await expect(page.getByText(/Starter pages added as drafts/)).toBeVisible();
  await expect(page.getByText("Draft", { exact: true })).toHaveCount(4);

  await page.getByRole("link", { name: /^FAQ/ }).click();
  await page.waitForURL(/\/admin\/guides\/.+/);
  const body = page.getByLabel("Page text");
  await body.fill(
    "## Can I bring a friend?\n\n**Yes!** See the [Rules page](/rules).\n\n<script>window.pwned = true</script>\n\n[bad](javascript:alert(1))",
  );
  await page.getByLabel("Published (visible to everyone)").check();
  await page.getByRole("button", { name: "Save page" }).click();
  await expect(page.getByText("Saved.")).toBeVisible();
  await logout(page);
});

test("visitors read published guides; drafts and raw HTML never show", async ({ page }) => {
  await page.goto("/guides");
  await expect(page.getByRole("link", { name: /FAQ/ })).toBeVisible();
  await expect(page.getByRole("link", { name: /Venue and what to bring/ })).toHaveCount(0);

  await page.getByRole("link", { name: /FAQ/ }).click();
  await expect(page.getByRole("heading", { name: "Can I bring a friend?" })).toBeVisible();
  await expect(page.locator("main strong", { hasText: "Yes!" })).toBeVisible();
  await expect(page.getByRole("link", { name: "Rules page" })).toHaveAttribute("href", "/rules");
  expect(await page.locator("main script").count()).toBe(0);
  expect(await page.evaluate(() => (window as unknown as { pwned?: boolean }).pwned)).toBeUndefined();
  const bad = page.getByRole("link", { name: "bad" });
  if (await bad.count()) expect(await bad.getAttribute("href")).not.toMatch(/^javascript:/);

  expect((await page.goto("/guides/venue"))?.status()).toBe(404);
});

test("admin restores an earlier version and deletes a page", async ({ page }) => {
  await loginOk(page, E2E_ADMIN.runnerName, E2E_ADMIN.password);
  await page.goto("/admin/guides");
  await page.getByRole("link", { name: /^FAQ/ }).click();
  await page.waitForURL(/\/admin\/guides\/.+/);
  await page.getByRole("button", { name: "Restore" }).first().click();
  await page.getByRole("button", { name: "Tap again to confirm" }).click();
  await expect(page.getByText("Earlier version restored.")).toBeVisible();
  await expect(page.getByLabel("Page text")).toHaveValue(/How do I sign up for an event\?/);

  await page.goto("/admin/guides");
  await page.getByRole("link", { name: /^Venue and what to bring/ }).click();
  await page.waitForURL(/\/admin\/guides\/.+/);
  await page
    .getByLabel('Type "Venue and what to bring" to delete this page and its history')
    .fill("Venue and what to bring");
  await page.getByRole("button", { name: "Delete page" }).click();
  await expect(page.getByText("Page deleted.")).toBeVisible();
  await expect(page.getByRole("link", { name: /^Venue/ })).toHaveCount(0);

  await page.goto("/admin/audit?q=guide");
  await expect(page.getByText("Deleted guide page")).toBeVisible();
  await expect(page.getByText("Restored guide version")).toBeVisible();
});

test("players cannot edit guides", async ({ page, request }) => {
  const res = await page.goto("/admin/guides");
  // Not logged in: sent to login.
  await expect(page).toHaveURL(/\/login\?next=%2Fadmin%2Fguides/);
  expect(res?.ok()).toBe(true);
  void request;
});
