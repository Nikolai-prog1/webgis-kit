import { test, expect } from '@playwright/test';
test.beforeEach(async ({ page }) => {
  await page.route('https://**/*', (route) => route.abort());
  await page.goto('/');
  await expect(page.locator('.ol-viewport')).toBeVisible();
  await expect(page.locator('.wg-loading')).toBeHidden();
});
test('search handles one and multiple results', async ({ page }) => {
  await page.getByLabel('Find a city', { exact: true }).fill('London');
  await page.getByRole('button', { name: 'Search', exact: true }).click();
  await expect(page.locator('.wg-popup__title')).toHaveText('London');
  await page.getByLabel('Find a city', { exact: true }).fill('a');
  await page.getByRole('button', { name: 'Search', exact: true }).click();
  await expect(page.locator('.wg-results .wg-result').first()).toBeVisible();
  await expect(page.locator('.wg-results .wg-result')).not.toHaveCount(1);
});
test('an empty new search clears the previous popup and highlights', async ({
  page,
}) => {
  await page.getByLabel('Find a city', { exact: true }).fill('London');
  await page.getByRole('button', { name: 'Search', exact: true }).click();
  await expect(page.locator('.wg-popup')).toBeVisible();
  await page
    .getByLabel('Find a city', { exact: true })
    .fill('No matching city record');
  await page.getByRole('button', { name: 'Search', exact: true }).click();
  await expect(page.locator('.wg-popup')).toBeHidden();
  await expect(page.locator('.wg-toasts')).toContainText('No results found.');
});
test('closing results or clearing the map removes query displays and counts', async ({
  page,
}) => {
  const input = page.getByLabel('Find a city', { exact: true });
  const searchForm = input.locator('xpath=ancestor::form');
  await input.fill('a');
  await searchForm.getByRole('button', { name: 'Search', exact: true }).click();
  const results = page
    .locator('[data-panel^="results-"]')
    .filter({ has: page.locator('.wg-results') });
  await expect(results).toBeVisible();
  await results.locator('.wg-result').first().click();
  await expect(page.locator('.wg-popup')).toBeVisible();
  await results.getByRole('button', { name: 'Close', exact: true }).click();
  await expect(page.locator('.wg-popup')).toBeHidden();
  await input.fill('London');
  await searchForm.getByRole('button', { name: 'Search', exact: true }).click();
  await expect(searchForm.locator('[aria-live]')).toHaveText('Results: 1');
  await page.getByRole('button', { name: 'Clear map', exact: true }).click();
  await expect(page.locator('.wg-popup')).toBeHidden();
  await expect(searchForm.locator('[aria-live]')).toBeEmpty();
  await expect(input).toHaveValue('London');
  await page
    .getByRole('button', { name: 'Filter countries', exact: true })
    .click();
  const continent = page.getByLabel('Continent', { exact: true });
  const filterForm = continent.locator('xpath=ancestor::form');
  await continent.selectOption({ label: 'Europe' });
  await filterForm
    .getByRole('button', { name: 'Apply filter', exact: true })
    .click();
  await expect(filterForm.locator('[aria-live]')).toContainText('Results:');
  await page.getByRole('button', { name: 'Clear map', exact: true }).click();
  await expect(filterForm.locator('[aria-live]')).toBeEmpty();
  await expect(page.locator('.wg-results:visible')).toHaveCount(0);
  await expect(continent).toHaveValue(JSON.stringify('Europe'));
});
test('country filter and table sorting selection CSV', async ({ page }) => {
  await page
    .getByRole('button', { name: 'Filter countries', exact: true })
    .click();
  await page
    .getByLabel('Continent', { exact: true })
    .selectOption({ label: 'Europe' });
  await page.getByRole('button', { name: 'Apply filter', exact: true }).click();
  await expect(page.locator('.wg-results .wg-result').first()).toBeVisible();
  await page
    .getByRole('button', { name: 'Attribute table: Cities', exact: true })
    .click();
  const table = page.getByRole('dialog', { name: 'Cities', exact: true });
  await expect(table.locator('tbody tr')).toHaveCount(100);
  await table
    .getByRole('button', { name: 'Sort by Name', exact: true })
    .click();
  await table.locator('tbody tr').first().click();
  await expect(table.locator('tbody tr').first()).toContainText('Abidjan');
  const [download] = await Promise.all([
    page.waitForEvent('download'),
    table.getByRole('button', { name: 'Download CSV' }).click(),
  ]);
  expect(download.suggestedFilename()).toBe('cities.csv');
});

test('failed WFS page and sort keep the displayed rows and committed state', async ({
  page,
}) => {
  await page.route('**/config/app.json', async (route) => {
    const response = await route.fetch();
    const config = await response.json();
    config.services.main = {
      type: 'geoserver',
      url: 'test-geoserver',
      workspace: 'demo',
    };
    const cities = config.layers.find((layer) => layer.id === 'cities');
    cities.source = { type: 'wms', service: 'main', layers: 'cities' };
    cities.visible = false;
    await route.fulfill({ json: config });
  });
  let failPage = true,
    failSort = true;
  const sortRequests = [];
  await page.route('**/test-geoserver/**', async (route) => {
    const url = new URL(route.request().url());
    if (url.searchParams.get('request') === 'DescribeFeatureType') {
      return route.fulfill({
        json: {
          featureTypes: [
            {
              properties: [
                { name: 'name', type: 'xsd:string' },
                { name: 'population', type: 'xsd:double' },
                { name: 'geom', type: 'gml:PointPropertyType' },
              ],
            },
          ],
        },
      });
    }
    const offset = Number(url.searchParams.get('startIndex') || 0),
      sort = url.searchParams.get('sortBy');
    if (sort) sortRequests.push(sort);
    const failure =
      offset === 100 && failPage
        ? 'Second page unavailable'
        : sort && failSort
          ? 'Sort unavailable'
          : '';
    if (failure)
      return route.fulfill({
        status: 400,
        contentType: 'application/xml',
        body: `<ows:ExceptionReport xmlns:ows="http://www.opengis.net/ows"><ows:Exception><ows:ExceptionText>${failure}</ows:ExceptionText></ows:Exception></ows:ExceptionReport>`,
      });
    return route.fulfill({
      json: {
        type: 'FeatureCollection',
        numberMatched: 177,
        features: Array.from(
          { length: Math.max(0, Math.min(100, 177 - offset)) },
          (_, i) => ({
            type: 'Feature',
            id: `row.${offset + i}`,
            properties: {
              name: `Record ${offset + i}`,
              population: offset + i,
            },
            geometry: null,
          }),
        ),
      },
    });
  });
  await page.reload();
  await page
    .getByRole('button', { name: 'Attribute table: Cities', exact: true })
    .click();
  const table = page.getByRole('dialog', { name: 'Cities', exact: true });
  const counter = table.locator('[aria-live="polite"]');
  await expect(table.locator('tbody tr')).toHaveCount(100);
  await expect(counter).toHaveText('1–100 of 177');
  await table.getByRole('button', { name: 'Next page', exact: true }).click();
  await expect(page.locator('.wg-toasts')).toContainText(
    'Second page unavailable',
  );
  await expect(counter).toHaveText('1–100 of 177');
  await expect(table.locator('tbody tr')).toHaveCount(100);
  await expect(table.locator('tbody tr').first()).toContainText('Record 0');
  failPage = false;
  await table.getByRole('button', { name: 'Next page', exact: true }).click();
  await expect(counter).toHaveText('101–177 of 177');
  await expect(table.locator('tbody tr')).toHaveCount(77);
  await table
    .getByRole('button', { name: 'Sort by Population', exact: true })
    .click();
  await expect(page.locator('.wg-toasts')).toContainText('Sort unavailable');
  await expect(counter).toHaveText('101–177 of 177');
  await expect(table.locator('tbody tr').first()).toContainText('Record 100');
  failSort = false;
  await table
    .getByRole('button', { name: 'Sort by Population', exact: true })
    .click();
  await expect(counter).toHaveText('1–100 of 177');
  expect(sortRequests.slice(-2)).toEqual(['population A', 'population A']);
});
