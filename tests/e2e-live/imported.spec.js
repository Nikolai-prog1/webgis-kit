import { test, expect } from '@playwright/test';

test('imported Cyrillic text matches case variants through server-side search', async ({
  page,
}) => {
  test.skip(
    !process.env.WEBGIS_LIVE_INSTANCE,
    'Requires an imported instance.',
  );
  await page.goto('/?lang=en');
  await expect(page.locator('.wg-loading')).toBeHidden({ timeout: 30000 });
  const config = await page.evaluate(async () =>
    (await fetch('config/app.json')).json(),
  );
  const layer = config.layers.find((layer) => layer.id === 'region-7801');
  test.skip(!layer, 'Requires the projected Cyrillic fixture.');
  expect(layer.source.type).toBe('wms');
  const block = config.sidebar
    .flatMap((section) => section.blocks)
    .find(
      (block) => block.type === 'attribute-search' && block.layer === layer.id,
    );
  const input = page.getByRole('searchbox', {
    name: typeof block.label === 'string' ? block.label : block.label.en,
    exact: true,
  });
  const form = input.locator('xpath=ancestor::form');
  for (const value of ['софия', 'СОФИЯ']) {
    await form.getByRole('button', { name: 'Clear', exact: true }).click();
    await expect(page.locator('.wg-popup')).toBeHidden();
    await input.fill(value);
    const response = page.waitForResponse((response) =>
      [...new URL(response.url()).searchParams].some(
        ([key, text]) =>
          key.toLowerCase() === 'cql_filter' && text.includes(value),
      ),
    );
    await form.getByRole('button', { name: 'Search', exact: true }).click();
    const result = await response;
    expect(result.ok()).toBe(true);
    expect((await result.json()).features).toHaveLength(1);
    await expect(page.locator('.wg-popup')).toContainText('София');
  }
});

test('an imported layer renders with identify, table and automatic search/filter', async ({
  page,
}, testInfo) => {
  test.skip(
    !process.env.WEBGIS_LIVE_INSTANCE,
    'Requires an explicitly selected imported instance.',
  );
  const errors = [];
  await page.emulateMedia({ reducedMotion: 'reduce' });
  page.on('pageerror', (error) => errors.push(error.message));
  await page.goto('/?lang=en');
  await expect(page.locator('.ol-viewport')).toBeVisible();
  await expect(page.locator('.wg-loading')).toBeHidden({ timeout: 30000 });
  const config = await page.evaluate(async () =>
    (await fetch('config/app.json')).json(),
  );
  const layer = config.layers.find((layer) => layer.source.type === 'wms');
  expect(layer).toBeTruthy();
  const title =
    typeof layer.title === 'string'
      ? layer.title
      : layer.title.en || Object.values(layer.title)[0];
  for (const other of config.layers)
    if (other.id !== layer.id) {
      const label =
        typeof other.title === 'string'
          ? other.title
          : other.title.en || Object.values(other.title)[0];
      await page.getByRole('checkbox', { name: label, exact: true }).uncheck();
    }
  const block = config.sidebar
    .flatMap((section) => section.blocks)
    .find(
      (block) => block.type === 'attribute-search' && block.layer === layer.id,
    );
  expect(block).toBeTruthy();
  const label = typeof block.label === 'string' ? block.label : block.label.en;
  const input = page.getByRole('searchbox', { name: label, exact: true });
  await input.fill(process.env.WEBGIS_IMPORT_SEARCH_VALUE || 'London');
  const form = input.locator('xpath=ancestor::form');
  const searched = page.waitForResponse(
    (response) =>
      /request=getfeature/i.test(response.url()) &&
      response
        .url()
        .includes(process.env.WEBGIS_IMPORT_SEARCH_VALUE || 'London'),
  );
  await form.getByRole('button', { name: 'Search', exact: true }).click();
  const searchData = await (await searched).json();
  await expect(page.locator('.wg-popup')).toBeVisible();
  await expect(page.locator('.wg-popup__title')).toContainText(
    process.env.WEBGIS_IMPORT_SEARCH_VALUE || 'London',
  );
  await page.getByRole('button', { name: 'Clear map', exact: true }).click();
  const [longitude, latitude] = searchData.features[0].geometry.coordinates;
  await page.getByRole('button', { name: 'Coordinates', exact: true }).click();
  const coordinates = page.getByRole('dialog', {
    name: 'Coordinates',
    exact: true,
  });
  await coordinates
    .getByLabel('Enter coordinates', { exact: true })
    .fill(`${latitude}, ${longitude}`);
  await coordinates
    .getByRole('button', { name: 'Go to coordinates', exact: true })
    .click();
  await page.getByRole('button', { name: 'Clear map', exact: true }).click();
  await expect(page.locator('.wg-loading')).toBeHidden({ timeout: 20000 });
  const map = page.locator('.wg-map'),
    box = await map.boundingBox();
  const info = page.waitForResponse((response) =>
    /request=getfeatureinfo/i.test(response.url()),
  );
  await map.click({ position: { x: box.width / 2, y: box.height / 2 } });
  expect((await info).ok()).toBe(true);
  await expect(page.locator('.wg-popup')).toBeVisible();
  await page
    .getByRole('button', { name: `Attribute table: ${title}`, exact: true })
    .click();
  const table = page.getByRole('dialog', { name: title, exact: true });
  await expect(table.locator('tbody tr').first()).toBeVisible();
  await table.getByRole('button', { name: 'Close', exact: true }).click();
  await page
    .getByRole('button', { name: 'Apply filter', exact: true })
    .first()
    .click();
  await expect(page.locator('.wg-results .wg-result').first()).toBeVisible();
  await page.screenshot({
    path: testInfo.outputPath('imported-layer.png'),
    fullPage: true,
  });
  expect(errors).toEqual([]);
  await expect(page.locator('.wg-toast--error')).toHaveCount(0);
});
