import { test, expect } from '@playwright/test';
import { offline } from './offline.js';
test('loads and uses core features without browser errors or external network', async ({
  page,
}) => {
  const errors = [];
  page.on('pageerror', (error) => errors.push(error.message));
  page.on('console', (message) => {
    if (message.type() === 'error') errors.push(message.text());
  });
  await offline(page);
  await page.goto('/');
  await expect(page.locator('.ol-viewport')).toBeVisible();
  await expect(page.locator('.wg-loading')).toBeHidden();
  await page.getByLabel('Find a city', { exact: true }).fill('Berlin');
  await page.getByRole('button', { name: 'Search', exact: true }).click();
  await expect(page.locator('.wg-popup__title')).toHaveText('Berlin');
  await page.getByRole('button', { name: 'Clear map', exact: true }).click();
  await page.getByRole('button', { name: 'External WMS', exact: true }).click();
  await page
    .getByRole('checkbox', { name: 'Browse external WMS', exact: true })
    .check();
  const panel = page.getByRole('dialog', { name: 'External WMS', exact: true });
  await panel
    .getByRole('checkbox', { name: 'OpenStreetMap WMS', exact: true })
    .check();
  await expect(page.locator('.wg-loading')).toBeHidden();
  await expect(page.locator('.wg-toast--error')).toHaveCount(0);
  expect(errors).toEqual([]);
});
