import { expect, type Page } from "@playwright/test";

export const E2E_ADMIN = { runnerName: "E2E Admin", password: "quiet-orbit-lantern-7" };
export const PASSWORD = "neon-subroutine-88";

let counter = 0;
/** Unique, valid runner name (<= 24 chars) per call. */
export function uniqueName(prefix = "Runner"): string {
  counter += 1;
  return `${prefix} ${Date.now().toString(36).slice(-5)}${counter}`.slice(0, 24);
}

export async function register(page: Page, runnerName: string, password = PASSWORD) {
  await page.goto("/register");
  await page.getByLabel("Runner name").fill(runnerName);
  await page.getByLabel("Password", { exact: true }).fill(password);
  await page.getByLabel("Confirm password").fill(password);
  await page.getByRole("button", { name: "Create account" }).click();
  await expect(page).toHaveURL(/\/account\?welcome=1/);
}

export async function login(page: Page, runnerName: string, password = PASSWORD) {
  await page.goto("/login");
  await page.getByLabel("Runner name").fill(runnerName);
  await page.getByLabel("Password").fill(password);
  await page.getByRole("button", { name: "Log in" }).click();
}

export async function logout(page: Page) {
  await page.getByRole("button", { name: "Log out" }).click();
  await expect(page.getByRole("banner").getByRole("link", { name: "Log in" })).toBeVisible();
}

/** The form's error message (Next.js also renders an empty role=alert route announcer). */
export function formError(page: Page) {
  return page.locator('p[role="alert"]');
}

/** Logs in and waits until the app has redirected away from the login page. */
export async function loginOk(page: Page, runnerName: string, password = PASSWORD) {
  await login(page, runnerName, password);
  await page.waitForURL((url) => url.pathname !== "/login");
}
