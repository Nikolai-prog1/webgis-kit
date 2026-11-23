import { test, expect } from '@playwright/test';
test.beforeEach(async ({ page }) => {
  await page.route('https://**/*', (route) => route.abort());
  await page.goto('/');
  await expect(page.locator('.ol-viewport')).toBeVisible();
  await expect(page.locator('.wg-loading')).toBeHidden();
});
test('base map choice opacity and layers synchronize', async ({ page }) => {
  await page.getByRole('radio', { name: 'OpenStreetMap', exact: true }).check();
  await expect(
    page.getByRole('radio', { name: 'OpenStreetMap', exact: true }),
  ).toBeChecked();
  await page.getByLabel('Opacity', { exact: true }).fill('50');
  await page.getByRole('checkbox', { name: 'Rivers', exact: true }).uncheck();
  await expect(
    page.getByRole('checkbox', { name: 'Rivers', exact: true }),
  ).not.toBeChecked();
  await page.reload();
  await expect(page.getByLabel('Opacity', { exact: true })).toHaveValue('50');
});
test('identify finds a visible vector city', async ({ page }) => {
  const map = page.locator('.wg-map');
  const box = await map.boundingBox();
  const resolution = 156543.03392804097 / 8;
  const lon = -0.118667702475932;
  const lat = 51.5019405883275;
  const x = (lon * 20037508.342789244) / 180;
  const y =
    (Math.log(Math.tan(((90 + lat) * Math.PI) / 360)) * 20037508.342789244) /
    Math.PI;
  const centerY =
    (Math.log(Math.tan(((90 + 38) * Math.PI) / 360)) * 20037508.342789244) /
    Math.PI;
  await map.click({
    position: {
      x: box.width / 2 + (x - (12 * 20037508.342789244) / 180) / resolution,
      y: box.height / 2 - (y - centerY) / resolution,
    },
  });
  await expect(page.locator('.wg-popup__title')).toHaveText('London');
});
