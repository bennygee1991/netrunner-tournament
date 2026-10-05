import { expect, test } from "@playwright/test";
import { PASSWORD, formError, login, logout, register, uniqueName } from "./fixtures";

test("register, see account, log out, log back in", async ({ page }) => {
  const name = uniqueName("Kate");
  await register(page, name);
  await expect(page.getByText(`Welcome to the Circuit, ${name}`)).toBeVisible();
  await expect(page.getByRole("link", { name })).toBeVisible();

  await logout(page);
  await login(page, name.toUpperCase());
  await expect(page).toHaveURL("/");
  await expect(page.getByRole("link", { name })).toBeVisible();
});

test("register shows validation errors and a taken name", async ({ page }) => {
  const name = uniqueName("Taken");
  await register(page, name);
  await logout(page);

  await page.goto("/register");
  await page.getByLabel("Runner name").fill(name.toLowerCase());
  await page.getByLabel("Password", { exact: true }).fill(PASSWORD);
  await page.getByLabel("Confirm password").fill(PASSWORD);
  await page.getByRole("button", { name: "Create account" }).click();
  await expect(page.getByText("That runner name is taken.")).toBeVisible();

  await page.getByLabel("Runner name").fill(uniqueName("Fresh"));
  await page.getByLabel("Password", { exact: true }).fill("password123");
  await page.getByLabel("Confirm password").fill("password123");
  await page.getByRole("button", { name: "Create account" }).click();
  await expect(page.getByText(/too common/)).toBeVisible();
});

test("wrong password gives a generic error", async ({ page }) => {
  const name = uniqueName("Wrong");
  await register(page, name);
  await logout(page);
  await login(page, name, "definitely-not-it");
  await expect(formError(page)).toHaveText("Runner name or password is incorrect.");
  await login(page, "No Such Runner Here", PASSWORD);
  await expect(formError(page)).toHaveText("Runner name or password is incorrect.");
});

test("protected pages redirect to login and return afterwards", async ({ page }) => {
  const name = uniqueName("Next");
  await register(page, name);
  await logout(page);
  await page.goto("/account/password");
  await expect(page).toHaveURL(/\/login\?next=%2Faccount%2Fpassword/);
  await page.getByLabel("Runner name").fill(name);
  await page.getByLabel("Password").fill(PASSWORD);
  await page.getByRole("button", { name: "Log in" }).click();
  await expect(page).toHaveURL("/account/password");
});

test("session cookie is HttpOnly and SameSite=Lax, and CSP is set", async ({ page, context }) => {
  await register(page, uniqueName("Cookie"));
  const cookie = (await context.cookies()).find((c) => c.name.endsWith("nc_session"));
  expect(cookie?.httpOnly).toBe(true);
  expect(cookie?.sameSite).toBe("Lax");
  const res = await page.goto("/");
  expect(res?.headers()["content-security-policy"]).toContain("script-src 'self' 'nonce-");
});

test("change password logs in with the new one", async ({ page }) => {
  const name = uniqueName("Changer");
  await register(page, name);
  await page.goto("/account/password");
  await page.getByLabel("Current password").fill(PASSWORD);
  await page.getByLabel("New password", { exact: true }).fill("fresh-cyberdeck-31");
  await page.getByLabel("Confirm new password").fill("fresh-cyberdeck-31");
  await page.getByRole("button", { name: "Change password" }).click();
  await expect(page.getByText("Password changed.")).toBeVisible();
  await logout(page);
  await login(page, name, "fresh-cyberdeck-31");
  await expect(page).toHaveURL("/");
});

test("theme preference is applied", async ({ page }) => {
  await register(page, uniqueName("Theme"));
  await page.getByRole("radio", { name: "Classic light" }).check();
  await page.getByRole("button", { name: "Save profile" }).click();
  await expect(page.getByText("Saved.")).toBeVisible();
  await page.reload();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "light");
});

test("a site theme previews instantly, saves to the profile and applies to every page", async ({ page }) => {
  await register(page, uniqueName("Synth"));
  const html = page.locator("html");
  const bg = () => page.evaluate(() => getComputedStyle(document.body).backgroundColor);
  const before = await bg();

  // Tapping a theme previews it straight away (not saved yet).
  await page.getByRole("radio", { name: "Synthwave" }).check();
  await expect(html).toHaveAttribute("data-theme", "synthwave");
  expect(await bg()).not.toBe(before);

  await page.getByRole("button", { name: "Save profile" }).click();
  await expect(page.getByText("Saved.")).toBeVisible();

  // Saved: it follows the player to every page, after a reload and when logged back in.
  for (const path of ["/", "/events", "/leaderboards", "/players", "/trophies", "/rules", "/account"]) {
    await page.goto(path);
    await expect(html, path).toHaveAttribute("data-theme", "synthwave");
  }
  // The browser chrome colour follows the theme too.
  await expect(page.locator('meta[name="theme-color"]')).toHaveAttribute("content", "#140b2e");
});

test("players cannot reach the admin area", async ({ page }) => {
  await register(page, uniqueName("Sneaky"));
  const res = await page.goto("/admin/players");
  expect(res?.status()).toBe(404);
});

test("players download their data and delete their own account", async ({ page }) => {
  const name = uniqueName("Bye");
  await register(page, name);
  await page.goto("/account");

  const download = page.waitForEvent("download");
  await page.getByRole("button", { name: "Download my data" }).click();
  const file = await download;
  expect(file.suggestedFilename()).toMatch(/^my-circuit-data-\d{4}-\d{2}-\d{2}\.json$/);
  const text = await (await import("node:fs/promises")).readFile((await file.path())!, "utf8");
  expect(JSON.parse(text).account.runnerName).toBe(name);
  expect(text).not.toContain("argon2");

  const del = page.getByRole("button", { name: "Delete my account" });
  await expect(del).toBeDisabled();
  await page.getByLabel(`Type "${name}" to confirm`).fill(name);
  await page.getByLabel("Your password").fill("wrong password!!");
  await del.click();
  await expect(page.getByText("Password is incorrect.")).toBeVisible();
  await page.getByLabel("Your password").fill(PASSWORD);
  await del.click();
  await expect(page).toHaveURL("/?notice=account-deleted");
  await expect(page.getByText("Your account has been deleted.")).toBeVisible();
  await expect(page.getByRole("banner").getByRole("link", { name: "Log in" })).toBeVisible();
  await login(page, name);
  await expect(formError(page)).toHaveText("Runner name or password is incorrect.");
});
