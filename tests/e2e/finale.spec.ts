import { expect, test, type Page } from "@playwright/test";
import { E2E_ADMIN, loginOk } from "./fixtures";

// Runs after event-flow.spec.ts, which created "E2E Season" (events 1-3 Swiss only, finale with a
// top 4 series cut).
test.describe.configure({ mode: "serial" });

/** Taps side A ("first") or B ("last") for one game of a cut match and waits until it is saved. */
async function tap(page: Page, testId: string, game: number, side: "first" | "last") {
  const row = () =>
    page
      .getByTestId(testId)
      .locator("form")
      .filter({ has: page.locator(`input[name="game"][value="${game}"]`) })
      .getByRole("button")
      [side]();
  await row().click();
  // Saved: the button shows as pressed, or the round completed and the entry was replaced.
  await expect(async () => {
    const gone = (await row().count()) === 0;
    expect(gone || (await row().getAttribute("aria-pressed")) === "true").toBe(true);
  }).toPass();
}
const tapA = (page: Page, testId: string, game: number) => tap(page, testId, game, "first");
const tapB = (page: Page, testId: string, game: number) => tap(page, testId, game, "last");

test("the season finale plays a top 4 cut where the higher seed picks sides", async ({ page }) => {
  await loginOk(page, E2E_ADMIN.runnerName, E2E_ADMIN.password);
  await page.goto("/admin/season");
  await expect(page.getByText(/Event 2.*no cut/).first()).toBeVisible();
  await page.getByRole("link", { name: /Season finale/ }).click();
  await expect(page.getByText(/top 4 cut \(higher seed picks sides, 2 games \+ decider\)/)).toBeVisible();
  await expect(page.getByRole("radio", { name: /^Higher seed picks sides/ })).toBeChecked();

  for (const guest of ["Fin One", "Fin Two", "Fin Three", "Fin Four"]) {
    await page.getByLabel("Add player").fill(guest);
    await page.getByRole("button", { name: "Add", exact: true }).click();
    await expect(page.getByText(`Added ${guest} (walk-in guest).`)).toBeVisible();
  }
  await page.getByLabel("Swiss rounds").fill("1");
  await page.getByRole("button", { name: "Save event" }).click();
  await expect(page.getByText("Event saved.")).toBeVisible();

  await page.getByRole("button", { name: "Start Swiss" }).click();
  for (const i of [0, 1]) {
    const m = page.getByTestId(`match-swiss-0-${i}`);
    await m.getByRole("button").first().click();
    await expect(m.getByRole("button").first()).toHaveAttribute("aria-pressed", "true");
  }
  await page.getByRole("button", { name: "Start top 4 cut" }).click();
  await expect(page.getByRole("heading", { name: "Semifinals" })).toBeVisible();

  // Semifinal 1: the organizer enters the higher seed's choice, then 1-1 forces a decider.
  const semi = "match-cut-0-0";
  await expect(page.getByTestId(semi).getByText(/is the higher seed and picks sides/)).toBeVisible();
  await page
    .getByTestId(semi)
    .getByRole("button", { name: /plays Corp first/ })
    .click();
  await expect(page.getByTestId(semi).getByText("Game 2 · sides swap")).toBeVisible();
  await tapA(page, semi, 1);
  await tapB(page, semi, 2);
  await expect(page.getByTestId(semi).getByText(/Game 3 · decider/)).toBeVisible();
  await tapA(page, semi, 3);
  await expect(page.getByTestId(semi).getByText(/wins the match/)).toBeVisible();

  // Semifinal 2: 2-0, no decider.
  const semi2 = "match-cut-0-1";
  await page
    .getByTestId(semi2)
    .getByRole("button", { name: /plays Runner first/ })
    .click();
  await tapA(page, semi2, 1);
  await tapA(page, semi2, 2);

  await expect(page.getByRole("heading", { name: "Final", exact: true })).toBeVisible();
  const final = "match-cut-1-0";
  await page
    .getByTestId(final)
    .getByRole("button", { name: /plays Corp first/ })
    .click();
  await tapB(page, final, 1);
  await tapB(page, final, 2);
  await expect(page.getByText("Event finished. Points are on the leaderboards.")).toBeVisible();

  // Public page: flowchart shows the cut scores; the list view shows each game.
  const url = page.url().replace("/admin", "");
  await page.goto(url);
  await expect(page.getByRole("cell", { name: "+20" })).toBeVisible(); // champion, double points
  await page.goto(`${url}?view=list`);
  await expect(page.getByText(/Game 3 · decider/).first()).toBeVisible();
});
