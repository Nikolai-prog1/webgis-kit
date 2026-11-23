import fs from 'node:fs';
import { test, expect } from '@playwright/test';
import { offline } from './offline.js';
test('captures the demo for documentation', async ({ page }) => {
  await offline(page);
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto('/');
  await expect(page.locator('.ol-viewport')).toBeVisible();
  await expect(page.locator('.wg-loading')).toBeHidden();
  await page.evaluate(() => document.fonts.ready);
  fs.mkdirSync('docs/screenshots', { recursive: true });
  await page.screenshot({ path: 'docs/screenshots/demo.png' });
  await page
    .getByRole('checkbox', { name: 'Open thematic catalog', exact: true })
    .check();
  const panel = page.getByRole('dialog', {
    name: 'Thematic layers',
    exact: true,
  });
  await panel
    .getByRole('radio', { name: 'Population theme', exact: true })
    .check();
  await expect(page.locator('.wg-loading')).toBeHidden();
  await page.screenshot({ path: 'docs/screenshots/catalog.png' });
  await panel.getByRole('button', { name: 'Close', exact: true }).click();
  await page.setViewportSize({ width: 390, height: 844 });
  await page.getByRole('button', { name: 'Layers', exact: true }).click();
  await page.screenshot({ path: 'docs/screenshots/mobile.png' });
});
