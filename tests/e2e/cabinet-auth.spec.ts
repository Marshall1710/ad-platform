import { expect, test } from '@playwright/test';
import { localConfig } from '../../scripts/local-config.mjs';

const base = process.env.CABINET_TEST_URL?.replace(/\/$/, '') ?? new URL(localConfig.urls.cabinet).origin;

test('visitor can reach login and protected cabinet redirects there', async ({ page }) => {
  await page.goto(`${base}/cabinet`);
  await expect(page).toHaveURL(`${base}/login`);
  await expect(page.getByRole('heading', { name: 'Вход в кабинет' })).toBeVisible();
});

test('advertiser registers, stays signed in, logs out and logs in again', async ({ page }) => {
  const email = `advertiser-${Date.now()}@example.com`;
  const password = 'password-123';
  await page.goto(`${base}/register`);
  await page.getByLabel('Email').fill(email);
  await page.getByLabel('Пароль').fill(password);
  await page.getByRole('button', { name: 'Зарегистрироваться' }).click();
  await expect(page).toHaveURL(`${base}/cabinet`);
  await expect(page.getByText(email)).toBeVisible();
  await expect(page.getByText('advertiser', { exact: true })).toBeVisible();
  await page.reload();
  await expect(page.getByText(email)).toBeVisible();
  await page.getByRole('button', { name: 'Выйти' }).click();
  await expect(page).toHaveURL(`${base}/login`);
  await page.goBack();
  await expect(page).toHaveURL(`${base}/login`);
  await expect(page.getByText(email)).not.toBeVisible();
  await page.goto(`${base}/cabinet`);
  await expect(page).toHaveURL(`${base}/login`);
  await page.getByLabel('Email').fill(email);
  await page.getByLabel('Пароль').fill(password);
  await page.getByRole('button', { name: 'Войти' }).click();
  await expect(page).toHaveURL(`${base}/cabinet`);
  await expect(page.getByText(email)).toBeVisible();
});

test('login uses the same error for unknown email and wrong password', async ({ page }) => {
  await page.goto(`${base}/login`);
  await page.getByLabel('Email').fill(`missing-${Date.now()}@example.com`);
  await page.getByLabel('Пароль').fill('wrong-password');
  await page.getByRole('button', { name: 'Войти' }).click();
  await expect(page.locator('.form-error')).toHaveText('Неверный email или пароль.');
});

test('advertiser can register when opening cabinet via localhost', async ({ page }) => {
  const localURL = new URL(base);
  test.skip(!['localhost', '127.0.0.1'].includes(localURL.hostname), 'Loopback alias is only available for local hosts');
  localURL.hostname = 'localhost';
  const localBase = localURL.origin;
  const email = `localhost-${Date.now()}@example.com`;
  await page.goto(`${localBase}/register`);
  await page.getByLabel('Email').fill(email);
  await page.getByLabel('Пароль').fill('password-123');
  await page.getByRole('button', { name: 'Зарегистрироваться' }).click();
  await expect(page).toHaveURL(`${localBase}/cabinet`);
  await expect(page.getByText(email)).toBeVisible();
  await page.getByRole('button', { name: 'Выйти' }).click();
  await expect(page).toHaveURL(`${localBase}/login`);
  await page.getByLabel('Email').fill(email);
  await page.getByLabel('Пароль').fill('password-123');
  await page.getByRole('button', { name: 'Войти' }).click();
  await expect(page).toHaveURL(`${localBase}/cabinet`);
  await expect(page.getByText(email)).toBeVisible();
});

test('registration rejects an unrelated Origin in production', async ({ request }) => {
  const email = `untrusted-${Date.now()}@example.com`;
  const response = await request.post(`${base}/api/auth/sign-up/email`, {
    headers: { origin: 'https://unrelated.example' },
    data: { email, password: 'password-123' },
  });
  expect(response.status()).toBe(403);
});
