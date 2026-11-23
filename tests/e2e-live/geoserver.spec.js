import { test, expect } from '@playwright/test';

test.skip(
  process.env.WEBGIS_LIVE_GEOSERVER !== '1',
  'Requires an explicitly enabled seeded GeoServer.',
);
let errors, wfsFailures, wmsPaths;
const operation = (url) => {
  const params = new URL(url).searchParams;
  return (params.get('request') || params.get('REQUEST') || '').toLowerCase();
};
test.beforeEach(async ({ page }) => {
  errors = [];
  wfsFailures = [];
  wmsPaths = [];
  page.on('request', (request) => {
    if (operation(request.url()) === 'getmap')
      wmsPaths.push(new URL(request.url()).pathname);
  });
  page.on('pageerror', (error) => errors.push(error.message));
  page.on('response', (response) => {
    if (
      response.url().includes('/geoserver/') &&
      operation(response.url()) === 'getfeature' &&
      !response.ok()
    )
      wfsFailures.push(response.status());
  });
  await page.addInitScript(() => {
    const original = HTMLAnchorElement.prototype.click;
    HTMLAnchorElement.prototype.click = function () {
      if (!this.hasAttribute('download')) return original.call(this);
      window.webgisExport = (async () => {
        const blob = await (await fetch(this.href)).blob();
        const bytes = new Uint8Array(await blob.arrayBuffer());
        const bitmap = await createImageBitmap(blob);
        const result = {
          type: blob.type,
          signature: [...bytes.slice(0, 8)],
          width: bitmap.width,
          height: bitmap.height,
        };
        bitmap.close();
        return result;
      })();
    };
  });
  await page.goto('/');
  await expect(page.locator('.ol-viewport')).toBeVisible();
  await expect(page.locator('.wg-loading')).toBeHidden({ timeout: 20000 });
});
test.afterEach(() => {
  expect(errors).toEqual([]);
  expect(wfsFailures).toEqual([]);
});

test('three WMS layers return PNGs through the workspace endpoint', async ({
  page,
}) => {
  await expect.poll(() => wmsPaths.length).toBeGreaterThan(0);
  expect(wmsPaths.every((path) => path === '/geoserver/demo/wms')).toBe(true);
  for (const layer of ['cities', 'rivers', 'countries']) {
    const response = await page.request.get('/geoserver/demo/wms', {
      params: {
        SERVICE: 'WMS',
        REQUEST: 'GetMap',
        VERSION: '1.1.1',
        LAYERS: `demo:${layer}`,
        STYLES: layer,
        SRS: 'EPSG:4326',
        BBOX: '-180,-85,180,85',
        WIDTH: 128,
        HEIGHT: 128,
        FORMAT: 'image/png',
      },
    });
    expect(response.status()).toBe(200);
    expect(response.headers()['content-type']).toContain('image/png');
    expect((await response.body()).subarray(0, 8)).toEqual(
      Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    );
  }
  const sources = await page.evaluate(async () =>
    (await (await fetch('config/app.json')).json()).layers.map(
      (layer) => layer.source,
    ),
  );
  expect(sources.every((source) => source.service === 'main')).toBe(true);
});

test('city search supports one and multiple WFS results', async ({ page }) => {
  await page.getByLabel('Find a city (WFS)', { exact: true }).fill('London');
  await page
    .getByRole('button', { name: 'Search', exact: true })
    .first()
    .click();
  await expect(page.locator('.wg-popup__title')).toHaveText('London');
  await page.getByLabel('Find a city (WFS)', { exact: true }).fill('a');
  await page
    .getByRole('button', { name: 'Search', exact: true })
    .first()
    .click();
  await expect(page.locator('.wg-results .wg-result').first()).toBeVisible();
  expect(await page.locator('.wg-results .wg-result').count()).toBeGreaterThan(
    1,
  );
});

test('unrestricted country filtering includes the polar feature', async ({
  page,
}) => {
  await page.getByRole('button', { name: 'Apply filter', exact: true }).click();
  await expect(page.locator('.wg-results .wg-result')).toHaveCount(177);
  await expect(page.locator('.wg-results')).toContainText('Antarctica');
});

test('country tables sort both ways and display the correct second page', async ({
  page,
}) => {
  await page
    .getByRole('button', { name: 'Attribute table: Countries', exact: true })
    .click();
  const table = page.getByRole('dialog', { name: 'Countries', exact: true });
  const counter = table.locator('[aria-live="polite"]');
  await expect(counter).toHaveText('1–100 of 177');
  for (const direction of ['A', 'D']) {
    const response = page.waitForResponse(
      (response) =>
        new URL(response.url()).searchParams.get('sortBy') ===
        `population ${direction}`,
    );
    await table
      .getByRole('button', { name: 'Sort by Population', exact: true })
      .click();
    expect((await response).status()).toBe(200);
    await expect(counter).toHaveText('1–100 of 177');
    await table.getByRole('button', { name: 'Next page', exact: true }).click();
    await expect(counter).toHaveText('101–177 of 177');
    await expect(table.locator('tbody tr')).toHaveCount(77);
  }
});

test('capabilities exposes only the three workspace layers in one group', async ({
  page,
}) => {
  const response = page.waitForResponse(
    (response) => operation(response.url()) === 'getcapabilities',
  );
  await page
    .getByRole('button', {
      name: 'Open catalog: Workspace catalog',
      exact: true,
    })
    .click();
  const capabilities = await response;
  expect(new URL(capabilities.url()).pathname).toBe('/geoserver/demo/wms');
  expect(capabilities.status()).toBe(200);
  const catalog = page.getByRole('dialog', {
    name: 'Workspace catalog',
    exact: true,
  });
  await expect(catalog.locator('.wg-catalog-group')).toHaveCount(1);
  await expect(catalog.locator('.wg-layer-row')).toHaveCount(3);
  for (const layer of ['cities', 'rivers', 'countries'])
    await expect(catalog).toContainText(layer);
});

async function move(page, coordinates) {
  await page.getByRole('button', { name: 'Coordinates', exact: true }).click();
  const dialog = page.getByRole('dialog', { name: 'Coordinates', exact: true });
  await dialog
    .getByLabel('Enter coordinates', { exact: true })
    .fill(coordinates);
  await dialog
    .getByRole('button', { name: 'Go to coordinates', exact: true })
    .click();
  await expect(dialog).toBeHidden();
  await page.getByRole('button', { name: 'Clear map', exact: true }).click();
  await expect(page.locator('.wg-loading')).toBeHidden({ timeout: 20000 });
}
test('identify shows a country and uses one request for an empty click', async ({
  page,
}) => {
  await page.getByRole('checkbox', { name: 'Cities', exact: true }).uncheck();
  await page.getByRole('checkbox', { name: 'Rivers', exact: true }).uncheck();
  await move(page, '47, 2');
  const map = page.locator('.wg-map');
  const box = await map.boundingBox();
  await map.click({ position: { x: box.width / 2, y: box.height / 2 } });
  await expect(page.locator('.wg-popup__title')).toHaveText('France');
  await move(page, '0, -140');
  const requests = [];
  page.on('request', (request) => {
    if (operation(request.url()) === 'getfeatureinfo')
      requests.push(request.url());
  });
  const response = page.waitForResponse(
    (response) => operation(response.url()) === 'getfeatureinfo',
  );
  await map.click({ position: { x: box.width / 2, y: box.height / 2 } });
  expect((await response).status()).toBe(200);
  await page.waitForTimeout(500);
  expect(requests).toHaveLength(1);
  await expect(page.locator('.wg-popup')).toBeHidden();
});

test('exports a valid PNG in memory without saving a download', async ({
  page,
}) => {
  await page.getByRole('button', { name: 'Export map', exact: true }).click();
  const dialog = page.getByRole('dialog', { name: 'Export map', exact: true });
  await dialog
    .getByRole('button', { name: 'Download PNG', exact: true })
    .click();
  await page.waitForFunction(() => !!window.webgisExport);
  const result = await page.evaluate(() => window.webgisExport);
  expect(result.type).toBe('image/png');
  expect(result.signature).toEqual([137, 80, 78, 71, 13, 10, 26, 10]);
  expect(result.width).toBeGreaterThan(100);
  expect(result.height).toBeGreaterThan(100);
});
