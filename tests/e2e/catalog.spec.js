import { test, expect } from '@playwright/test';
import { offline } from './offline.js';
test.beforeEach(async ({ page }) => {
  await offline(page);
  await page.goto('/');
  await expect(page.locator('.ol-viewport')).toBeVisible();
});
test('catalog selection exclusive themes opacity minimize and master state', async ({
  page,
}) => {
  const master = page.getByRole('checkbox', {
    name: 'Open thematic catalog',
    exact: true,
  });
  await master.check();
  const panel = page.getByRole('dialog', {
    name: 'Thematic layers',
    exact: true,
  });
  await panel
    .getByRole('checkbox', { name: 'Reference borders', exact: true })
    .check();
  await panel
    .getByRole('radio', { name: 'Population theme', exact: true })
    .check();
  await panel
    .getByRole('radio', { name: 'Regions theme', exact: true })
    .check();
  await expect(
    panel.getByRole('radio', { name: 'Population theme', exact: true }),
  ).not.toBeChecked();
  await panel.getByRole('tab', { name: /Active/ }).click();
  await panel
    .getByLabel('Opacity: Reference borders', { exact: true })
    .fill('55');
  await expect(
    panel.getByLabel('Opacity: Reference borders', { exact: true }),
  ).toHaveValue('55');
  await panel.getByRole('button', { name: 'Minimize', exact: true }).click();
  await expect(panel).toBeHidden();
  await page
    .getByRole('button', { name: 'Restore: Thematic layers', exact: true })
    .click();
  await panel.getByRole('button', { name: 'Close', exact: true }).click();
  await expect(master).toBeChecked();
  await master.uncheck();
  await master.check();
  await panel.getByRole('tab', { name: 'Catalog', exact: true }).click();
  await expect(
    panel.getByRole('checkbox', { name: 'Reference borders', exact: true }),
  ).toBeChecked();
});
test('external capabilities are fetched lazily and can display a layer', async ({
  page,
}) => {
  await page.getByRole('button', { name: 'External WMS', exact: true }).click();
  await page
    .getByRole('checkbox', { name: 'Browse external WMS', exact: true })
    .check();
  const panel = page.getByRole('dialog', { name: 'External WMS', exact: true });
  await panel
    .getByRole('checkbox', { name: 'OpenStreetMap WMS', exact: true })
    .check();
  await panel.getByRole('tab', { name: /Active/ }).click();
  await expect(
    panel.getByLabel('Opacity: OpenStreetMap WMS', { exact: true }),
  ).toBeVisible();
});
