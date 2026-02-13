import { test, expect } from "@playwright/test";

test.describe("Food Page", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/food");
  });

  test("loads the food page", async ({ page }) => {
    await expect(page.locator("h1")).toHaveText("Food Log");
  });

  test("opens add food modal", async ({ page }) => {
    await page.getByRole("button", { name: "Add" }).click();
    await expect(page.getByText("Add Food")).toBeVisible();
  });

  test("searches food database", async ({ page }) => {
    await page.getByRole("button", { name: "Add" }).click();
    await page.getByPlaceholder("Search food or type custom...").fill("chicken");
    await expect(page.getByText("Chicken Breast")).toBeVisible();
  });

  test("selects food and shows scaling controls", async ({ page }) => {
    await page.getByRole("button", { name: "Add" }).click();
    await page.getByPlaceholder("Search food or type custom...").fill("chicken breast");
    await page.getByText("Chicken Breast").click();
    // Should show serving/grams/calories toggle
    await expect(page.getByText("Grams")).toBeVisible();
    await expect(page.getByText("Calories", { exact: true })).toBeVisible();
  });

  test("switches to grams input mode", async ({ page }) => {
    await page.getByRole("button", { name: "Add" }).click();
    await page.getByPlaceholder("Search food or type custom...").fill("chicken breast");
    await page.getByText("Chicken Breast").click();
    await page.getByText("Grams").click();
    await expect(page.getByText("Weight in grams")).toBeVisible();
  });

  test("searches for beans", async ({ page }) => {
    await page.getByRole("button", { name: "Add" }).click();
    await page.getByPlaceholder("Search food or type custom...").fill("beans");
    await expect(page.getByText("Black Beans")).toBeVisible();
  });

  test("opens create meal modal", async ({ page }) => {
    await page.getByRole("button", { name: "Meal" }).click();
    await expect(page.getByText("Create Meal")).toBeVisible();
  });

  test("adds custom food entry", async ({ page }) => {
    await page.getByRole("button", { name: "Add" }).click();
    await page.getByPlaceholder("Search food or type custom...").fill("My Custom Snack");
    await page.locator('input[placeholder="0"]').first().fill("200");
    await page.getByRole("button", { name: "Add Entry" }).click();
    await expect(page.getByText("My Custom Snack")).toBeVisible();
  });
});
