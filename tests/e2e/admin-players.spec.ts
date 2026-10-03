import { expect, test, type Page } from "@playwright/test";
import { E2E_ADMIN, PASSWORD, formError, login, loginOk, logout, register, uniqueName } from "./fixtures";

async function openPlayer(page: Page, name: string) {
  await page.goto(`/admin/players?q=${encodeURIComponent(name)}`);
  await page.getByText(name, { exact: true }).click();
}

test("admin issues a temporary password and the player must change it", async ({ page }) => {
  const name = uniqueName("Forgot");
  await register(page, name);
  await logout(page);

  await loginOk(page, E2E_ADMIN.runnerName, E2E_ADMIN.password);
  await openPlayer(page, name);
  await page.getByRole("button", { name: "Issue temporary password" }).click();
  const temp = (await page.getByLabel("Temporary password").textContent())!.trim();
  expect(temp).toMatch(/^[a-z2-9]{4}-[a-z2-9]{4}-[a-z2-9]{4}$/);
  await logout(page);

  await login(page, name, PASSWORD);
  await expect(formError(page)).toHaveText("Runner name or password is incorrect.");

  await login(page, name, temp);
  await expect(page).toHaveURL("/account/password");
  await page.goto("/account");
  await expect(page).toHaveURL("/account/password");

  await page.getByLabel("Temporary password").fill(temp);
  await page.getByLabel("New password", { exact: true }).fill("my-own-password-5");
  await page.getByLabel("Confirm new password").fill("my-own-password-5");
  await page.getByRole("button", { name: "Change password" }).click();
  await expect(page).toHaveURL(/\/account\?changed=1/);
});

test("admin renames, disables and deletes a player", async ({ page }) => {
  const name = uniqueName("Typo");
  const fixed = uniqueName("Fixed");
  await register(page, name);
  await logout(page);

  await loginOk(page, E2E_ADMIN.runnerName, E2E_ADMIN.password);
  await openPlayer(page, name);
  await page.getByLabel("Rename runner").fill(fixed);
  await page.getByRole("button", { name: "Save name" }).click();
  await expect(page.getByText("Renamed.")).toBeVisible();

  await openPlayer(page, fixed);
  await page.getByRole("button", { name: "Disable account" }).click();
  await expect(page.getByText("Disabled", { exact: true })).toBeVisible();
  await logout(page);
  await login(page, fixed);
  await expect(formError(page)).toHaveText("Runner name or password is incorrect.");

  await loginOk(page, E2E_ADMIN.runnerName, E2E_ADMIN.password);
  await openPlayer(page, fixed);
  await page.getByLabel(`Type "${fixed}" to delete this account`).fill("wrong");
  await page.getByRole("button", { name: "Delete account" }).click();
  await expect(page.getByText(`Type the runner name "${fixed}" exactly to confirm.`)).toBeVisible();
  await page.getByLabel(`Type "${fixed}" to delete this account`).fill(fixed);
  await page.getByRole("button", { name: "Delete account" }).click();
  await page.goto(`/admin/players?q=${encodeURIComponent(fixed)}`);
  await expect(page.getByText("No players found.")).toBeVisible();
});
