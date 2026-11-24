import { test, expect } from '@playwright/test';

// Runs against examples/configs/qgis-server with QGIS Server behind /qgis.
test.skip(
  process.env.WEBGIS_LIVE_QGIS !== '1',
  'Requires a running QGIS Server.',
);

const kind = (url) => {
  const params = new URL(url).searchParams;
  return (params.get('REQUEST') || params.get('request') || '').toLowerCase();
};

test('QGIS Server draws, identifies, searches, filters and pages a table', async ({
  page,
}, testInfo) => {
  const errors = [];
  const failures = [];
  page.on('pageerror', (error) => errors.push(error.message));
  page.on('response', (response) => {
    if (response.url().includes('/qgis/') && !response.ok())
      failures.push(`${response.status()} ${response.url()}`);
  });
  await page.emulateMedia({ reducedMotion: 'reduce' });
  const firstMap = page.waitForResponse(
    (response) => kind(response.url()) === 'getmap' && response.ok(),
  );
  await page.goto('/?lang=en');
  await expect(page.locator('.wg-loading')).toBeHidden({ timeout: 30000 });
  const map = await firstMap;
  expect(map.headers()['content-type']).toContain('image/png');

  // Search (WFS GetFeature with an OGC filter) finds one city and opens it.
  const search = page.getByRole('searchbox', { name: 'Cities', exact: true });
  await search.fill('Sofia');
  await search
    .locator('xpath=ancestor::form')
    .getByRole('button', { name: 'Search', exact: true })
    .click();
  await expect(page.locator('.wg-popup__title')).toHaveText('Sofia', {
    timeout: 20000,
  });
  await page.getByRole('button', { name: 'Clear map', exact: true }).click();

  // Identify (WMS GetFeatureInfo) at the map centre after going to Sofia.
  await page.getByRole('button', { name: 'Coordinates', exact: true }).click();
  const dialog = page.getByRole('dialog', { name: 'Coordinates', exact: true });
  await dialog
    .getByLabel('Enter coordinates', { exact: true })
    .fill('42.6853, 23.3147');
  await dialog
    .getByRole('button', { name: 'Go to coordinates', exact: true })
    .click();
  await page.getByRole('button', { name: 'Clear map', exact: true }).click();
  await expect(page.locator('.wg-loading')).toBeHidden({ timeout: 20000 });
  const box = await page.locator('.wg-map').boundingBox();
  const info = page.waitForResponse(
    (response) => kind(response.url()) === 'getfeatureinfo',
  );
  await page
    .locator('.wg-map')
    .click({ position: { x: box.width / 2, y: box.height / 2 } });
  expect((await info).ok()).toBe(true);
  await expect(page.locator('.wg-popup')).toContainText('Sofia', {
    timeout: 20000,
  });

  // Filter: cities above ten million.
  const filter = page.locator('form', {
    has: page.getByRole('button', { name: 'Apply filter' }),
  });
  await filter.getByLabel('Population: From', { exact: true }).fill('10000000');
  await filter
    .getByRole('button', { name: 'Apply filter', exact: true })
    .click();
  await expect(page.locator('.wg-results .wg-result').first()).toBeVisible({
    timeout: 20000,
  });

  // Attribute table: first page, then the next one.
  await page
    .getByRole('button', { name: 'Attribute table: Cities', exact: true })
    .click();
  const table = page.getByRole('dialog', { name: 'Cities', exact: true });
  await expect(table.locator('tbody tr').first()).toBeVisible({
    timeout: 20000,
  });
  const first = await table.locator('tbody tr').first().innerText();
  const next = table.getByRole('button', { name: 'Next page', exact: true });
  if (await next.isEnabled()) {
    await next.click();
    await expect(table.locator('tbody tr').first()).not.toHaveText(first, {
      timeout: 20000,
    });
  }
  await page.screenshot({
    path: testInfo.outputPath('qgis-server.png'),
    fullPage: true,
  });
  expect(failures).toEqual([]);
  expect(errors).toEqual([]);
});
