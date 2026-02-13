import { test, expect } from "@playwright/test";

test.describe("Navigation", () => {
  test("loads the dashboard", async ({ page }) => {
    await page.goto("/");
    await expect(page.locator("h1")).toContainText("Dashboard");
  });

  test("navigates to all pages", async ({ page }) => {
    await page.goto("/");

    await page.getByRole("link", { name: "Food" }).click();
    await expect(page).toHaveURL("/food");
    await expect(page.locator("h1")).toHaveText("Food Log");

    await page.getByRole("link", { name: "Weight" }).click();
    await expect(page).toHaveURL("/weight");
    await expect(page.locator("h1")).toHaveText("Weight");

    await page.getByRole("link", { name: "Workouts" }).click();
    await expect(page).toHaveURL("/workouts");
    await expect(page.locator("h1")).toHaveText("Workouts");

    await page.getByRole("link", { name: "Cardio" }).click();
    await expect(page).toHaveURL("/cardio");
    await expect(page.locator("h1")).toHaveText("Cardio");
  });
});
