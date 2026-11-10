import { expect, test } from "@playwright/test";
import { localConfig } from "../../scripts/local-config.mjs";

test("кабинет доступен", async ({ page }) => {
  await page.goto(localConfig.urls.cabinet);
  await expect(page.getByRole("heading", { name: "Кабинет рекламодателя" })).toBeVisible();
});

test("Аукцион доступен", async ({ page }) => {
  await page.goto(localConfig.urls.auction);
  await expect(page.getByRole("heading", { name: "Тестовый Аукцион" })).toBeVisible();
});

test("DSP доступен", async ({ request }) => {
  const response = await request.get(localConfig.urls.dsp);
  expect(response.ok()).toBe(true);
  expect(await response.json()).toEqual({ status: "ok" });
});
