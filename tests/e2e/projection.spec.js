import { test, expect } from '@playwright/test';
import { resolveCrs } from '../../tools/crs.mjs';

// The demo, re-projected: the map itself runs in BGS2005 / CCS2005 (EPSG:7801),
// a national Lambert projection, instead of Web Mercator.
test('a map in a national projection renders, reads and enters coordinates', async ({
  page,
}) => {
  const bgs = await resolveCrs('EPSG:7801');
  const errors = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.route('https://**/*', (route) => route.abort());
  await page.route('**/config/app.json', async (route) => {
    const config = await (await route.fetch()).json();
    config.crs.push(bgs);
    config.map.projection = 'EPSG:7801';
    config.map.homeExtent = [22.3, 41.2, 28.7, 44.3];
    config.map.openAtHome = true;
    config.statusBar.coordinates = ['EPSG:4326', 'EPSG:7801'];
    await route.fulfill({ json: config });
  });
  await page.goto('/');
  await expect(page.locator('.ol-viewport')).toBeVisible();
  await expect(page.locator('.wg-loading')).toBeHidden();

  await page.getByRole('button', { name: 'Coordinates', exact: true }).click();
  const dialog = page.getByRole('dialog', { name: 'Coordinates', exact: true });
  // Sofia in BGS2005, as computed by PROJ: E 320933.85, N 4730074.37.
  await dialog
    .getByLabel('Enter coordinates', { exact: true })
    .fill('320933.85 4730074.37');
  await dialog
    .getByRole('button', { name: 'Go to coordinates', exact: true })
    .click();
  const card = page.locator('.wg-marker-card');
  await expect(card).toContainText('23.3147');
  await expect(card).toContainText('42.6853');
  await expect(card).toContainText('320933.85');

  // The city lies under the marker at the map centre.
  const map = page.locator('.wg-map');
  const box = await map.boundingBox();
  await page.waitForTimeout(500);
  await map.click({ position: { x: box.width / 2, y: box.height / 2 } });
  await expect(page.locator('.wg-popup__title')).toHaveText('Sofia');
  expect(errors).toEqual([]);
});
