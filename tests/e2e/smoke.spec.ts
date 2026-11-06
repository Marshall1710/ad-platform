import { expect, test } from "@playwright/test";

test("кабинет доступен", async ({ page }) => {
  await page.goto("http://localhost:3000/");
  await expect(page.getByRole("heading", { name: "Кабинет рекламодателя" })).toBeVisible();
});

test("Аукцион доступен", async ({ page }) => {
  await page.goto("http://localhost:3001/");
  await expect(page.getByRole("heading", { name: "Тестовый Аукцион" })).toBeVisible();
});

test("DSP доступен", async ({ request }) => {
  const response = await request.get("http://localhost:8080/health");
  expect(response.ok()).toBe(true);
  expect(await response.json()).toEqual({ status: "ok" });
});
