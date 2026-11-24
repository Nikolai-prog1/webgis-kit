import { test, expect } from '@playwright/test';

// Hundreds of thousands of features in PostGIS behind GeoServer: the map,
// table paging, sorting and search must stay responsive.
test.skip(process.env.WEBGIS_LIVE_LARGE !== '1', 'Requires the large dataset.');

test('a large PostGIS layer stays usable', async ({ page }, testInfo) => {
  test.setTimeout(120000);
  const errors = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.goto('/?lang=en');
  await expect(page.locator('.wg-loading')).toBeHidden({ timeout: 60000 });
  const config = await page.evaluate(async () =>
    (await fetch('config/app.json')).json(),
  );
  const layer = config.layers.find((item) => item.source.type === 'wms');
  const title = typeof layer.title === 'string' ? layer.title : layer.title.en;
  const timings = {};
  let started = Date.now();
  await page
    .getByRole('button', { name: `Attribute table: ${title}`, exact: true })
    .click();
  const table = page.getByRole('dialog', { name: title, exact: true });
  await expect(table.locator('tbody tr').first()).toBeVisible({
    timeout: 30000,
  });
  timings.firstPage = Date.now() - started;
  const count = await table.getByText(/ of /).first().innerText();
  const total = Number(count.split(' of ')[1].replace(/[^\d]/g, ''));
  expect(total).toBeGreaterThan(100000);
  const first = await table.locator('tbody tr').first().innerText();
  started = Date.now();
  await table.getByRole('button', { name: 'Next page', exact: true }).click();
  await expect(table.locator('tbody tr').first()).not.toHaveText(first, {
    timeout: 30000,
  });
  timings.nextPage = Date.now() - started;
  const sortable = table.getByRole('button', { name: /^Sort by / }).first();
  started = Date.now();
  await sortable.click();
  await expect(table.locator('tbody tr').first()).toBeVisible({
    timeout: 30000,
  });
  timings.sort = Date.now() - started;
  await table.getByRole('button', { name: 'Close', exact: true }).click();
  const value = process.env.WEBGIS_IMPORT_SEARCH_VALUE;
  if (value) {
    const search = page.getByRole('searchbox').first();
    await search.fill(value);
    started = Date.now();
    await search
      .locator('xpath=ancestor::form')
      .getByRole('button', { name: 'Search', exact: true })
      .click();
    await expect(
      page.locator('.wg-popup, .wg-results .wg-result').first(),
    ).toBeVisible({ timeout: 30000 });
    timings.search = Date.now() - started;
  }
  console.log(
    `Large layer: ${total} features; timings (ms): ${JSON.stringify(timings)}`,
  );
  await page.screenshot({
    path: testInfo.outputPath('large.png'),
    fullPage: true,
  });
  for (const value of Object.values(timings)) expect(value).toBeLessThan(15000);
  expect(errors).toEqual([]);
});
