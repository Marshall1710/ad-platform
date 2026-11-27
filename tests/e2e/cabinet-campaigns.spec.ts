import { execFileSync } from 'node:child_process';
import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { expect, test } from '@playwright/test';
import sharp from 'sharp';
import { localConfig } from '../../scripts/local-config.mjs';

const base = process.env.CABINET_TEST_URL?.replace(/\/$/, '') ?? new URL(localConfig.urls.cabinet).origin;
const banner = join(mkdtempSync(join(tmpdir(), 'cabinet-banner-')), 'banner.png');

test.beforeAll(async () => {
  writeFileSync(banner, await sharp({
    create: { width: 300, height: 250, channels: 3, background: { r: 30, g: 90, b: 180 } },
  }).png().toBuffer());
});

function createOperatorAdmin(email: string, password: string) {
  execFileSync(process.execPath, [
    '--import', 'tsx',
    '--input-type=module',
    '-e',
    'import { createAdmin } from "./apps/cabinet/src/lib/create-admin.ts"; await createAdmin(process.argv[1], process.argv[2]);',
    email,
    password,
  ], {
    env: {
      ...process.env,
      DATABASE_URL: `postgresql://cabinet:cabinet_local@${localConfig.host}:${localConfig.ports.cabinetDb}/cabinet`,
      BETTER_AUTH_URL: base,
      BETTER_AUTH_SECRET: process.env.AUTH_SECRET,
    },
  });
}

async function submitCredentials(page: import('@playwright/test').Page, button: string) {
  for (let attempt = 0; attempt < 4; attempt += 1) {
    await page.getByRole('button', { name: button }).click();
    const outcome = await Promise.race([
      page.waitForURL(/\/cabinet$/, { timeout: 8_000 }).then(() => 'ok' as const),
      page.getByText('Слишком много попыток').waitFor({ timeout: 8_000 }).then(() => 'limited' as const),
    ]).catch(() => 'other' as const);
    if (outcome !== 'limited') return;
    await page.waitForTimeout(11_000);
  }
}

async function register(page: import('@playwright/test').Page, email: string) {
  await page.goto(`${base}/register`);
  await page.getByLabel('Email').fill(email);
  await page.getByLabel('Пароль').fill('password-123');
  await submitCredentials(page, 'Зарегистрироваться');
  await expect(page).toHaveURL(`${base}/cabinet`);
}

async function login(page: import('@playwright/test').Page, email: string) {
  await page.goto(`${base}/login`);
  await page.getByLabel('Email').fill(email);
  await page.getByLabel('Пароль').fill('password-123');
  await submitCredentials(page, 'Войти');
  await expect(page).toHaveURL(`${base}/cabinet`);
}

async function prepareActiveCampaign(page: import('@playwright/test').Page) {
  await page.getByRole('button', { name: 'Создать кампанию' }).click();
  await expect(page).toHaveURL(/\/cabinet\/campaigns\//);
  await expect(page.getByText('created', { exact: true })).toBeVisible();
  const campaignUrl = page.url();
  await page.reload();
  await expect(page.getByText('created', { exact: true })).toBeVisible();
  await page.getByLabel('Категория трафика').selectOption('mainstream');
  await page.getByLabel('Модель оплаты').selectOption('CPC');
  await page.getByLabel('Ставка, USD').fill('1.500');
  await page.getByRole('button', { name: 'Сохранить настройки' }).click();
  await expect(page.getByRole('status')).toHaveText('Настройки сохранены.');
  await page.getByLabel('Изображение').setInputFiles(banner);
  await page.getByLabel('Ссылка перехода').fill('https://example.com/landing');
  await page.getByRole('button', { name: 'Добавить креатив' }).click();
  await expect(page.getByRole('img', { name: 'Текущий креатив' })).toBeVisible();
  await page.getByRole('button', { name: 'Включить' }).click();
  await expect(page.getByText('active', { exact: true })).toBeVisible();
  return campaignUrl;
}

test('advertiser creates, activates and edits a campaign on a narrow screen', async ({ page }) => {
  test.setTimeout(90_000);
  await page.setViewportSize({ width: 390, height: 844 });
  const email = `campaign-${Date.now()}@example.com`;
  await register(page, email);
  await expect(page.getByRole('heading', { name: 'Пользователи' })).toHaveCount(0);
  const campaignUrl = await prepareActiveCampaign(page);
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth + 1);
  expect(overflow).toBe(false);
  await page.getByLabel('Ставка, USD').fill('2.000');
  await page.getByRole('button', { name: 'Сохранить настройки' }).click();
  await expect(page.getByRole('status')).toHaveText('Настройки сохранены.');
  await expect(page.getByText('active', { exact: true })).toBeVisible();
  await expect(page.getByLabel('Категория трафика')).toBeDisabled();
  await page.reload();
  await expect(page.getByLabel('Ставка, USD')).toHaveValue('2.000');
  await expect(page).toHaveURL(campaignUrl);
});

test('administrator pauses a campaign and the owner resumes it before deletion', async ({ page }) => {
  test.setTimeout(120_000);
  const email = `managed-${Date.now()}@example.com`;
  const adminEmail = `admin-${Date.now()}@example.com`;
  await register(page, email);
  const campaignUrl = await prepareActiveCampaign(page);
  await page.getByRole('button', { name: 'Выйти' }).click();
  createOperatorAdmin(adminEmail, 'password-123');
  await login(page, adminEmail);
  await expect(page.getByRole('heading', { name: 'Пользователи' })).toBeVisible();
  await page.getByRole('link', { name: new RegExp(email) }).click();
  await expect(page.getByText(email)).toBeVisible();
  await page.getByRole('link', { name: /active/ }).click();
  await expect(page).toHaveURL(campaignUrl);
  await page.getByRole('button', { name: 'Поставить на паузу' }).click();
  await expect(page.getByText('paused', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Выйти' }).click();
  await login(page, email);
  await page.goto(campaignUrl);
  await expect(page.getByText('paused', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Включить' }).click();
  await expect(page.getByText('active', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Выйти' }).click();
  await login(page, adminEmail);
  await page.goto(campaignUrl);
  await page.getByRole('button', { name: 'Поставить на паузу' }).click();
  await expect(page.getByText('paused', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Удалить кампанию' }).click();
  await expect(page.getByText('Кампаний пока нет.')).toBeVisible();
  await page.goto(campaignUrl);
  await expect(page.getByRole('heading', { name: 'Кампания не найдена' })).toBeVisible();
});

test('another advertiser cannot open a campaign by its address', async ({ page }) => {
  test.setTimeout(90_000);
  const owner = `hidden-${Date.now()}@example.com`;
  const other = `outsider-${Date.now()}@example.com`;
  await register(page, owner);
  await page.getByRole('button', { name: 'Создать кампанию' }).click();
  await expect(page).toHaveURL(/\/cabinet\/campaigns\//);
  const campaignUrl = page.url();
  await page.getByRole('button', { name: 'Выйти' }).click();
  await register(page, other);
  await page.goto(campaignUrl);
  await expect(page.getByRole('heading', { name: 'Кампания не найдена' })).toBeVisible();
  await page.goto(`${base}/cabinet`);
  await expect(page.getByRole('heading', { name: 'Пользователи' })).toHaveCount(0);
});
