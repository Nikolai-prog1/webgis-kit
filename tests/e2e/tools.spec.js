import fs from 'node:fs';
import { test, expect } from '@playwright/test';
import { offline } from './offline.js';
test.beforeEach(async ({ page }) => {
  await offline(page);
  await page.goto('/');
  await expect(page.locator('.ol-viewport')).toBeVisible();
  await expect(page.locator('.wg-loading')).toBeHidden();
});
test('measures distance and area then places and clears a marker', async ({
  page,
}) => {
  const map = page.locator('.wg-map');
  await page.getByRole('button', { name: 'Distance', exact: true }).click();
  await map.click({ position: { x: 400, y: 240 } });
  await map.dblclick({ position: { x: 540, y: 290 } });
  await expect(page.locator('.wg-measure-label--finished')).toHaveCount(1);
  await page.keyboard.press('Escape');
  await expect(
    page.getByRole('button', { name: 'Distance', exact: true }),
  ).toHaveAttribute('aria-pressed', 'false');
  await page.getByRole('button', { name: 'Area', exact: true }).click();
  await map.click({ position: { x: 400, y: 340 } });
  await map.click({ position: { x: 510, y: 350 } });
  await map.dblclick({ position: { x: 470, y: 420 } });
  await expect(page.locator('.wg-measure-label--finished')).toHaveCount(2);
  await page.getByRole('button', { name: 'Marker', exact: true }).click();
  await map.click({ position: { x: 600, y: 350 }, delay: 300 });
  await expect(page.locator('.wg-marker-card')).toContainText('WGS84');
  await page.getByRole('button', { name: 'Clear map', exact: true }).click();
  await expect(page.locator('.wg-marker-card')).toHaveCount(0);
  await expect(page.locator('.wg-measure-label')).toHaveCount(0);
});
test('removes individual measurements without affecting other tools or starting a sketch', async ({
  page,
}) => {
  const map = page.locator('.wg-map');
  const labels = page.locator('.wg-measure-label--finished');
  const distance = page.getByRole('button', { name: 'Distance', exact: true });
  await distance.click();
  await map.click({ position: { x: 390, y: 230 } });
  await map.dblclick({ position: { x: 530, y: 270 } });
  await expect(labels).toHaveCount(1);
  await page.getByRole('button', { name: 'Area', exact: true }).click();
  await map.click({ position: { x: 390, y: 360 } });
  await map.click({ position: { x: 510, y: 360 } });
  await map.dblclick({ position: { x: 450, y: 440 } });
  await expect(labels).toHaveCount(2);
  await page.getByRole('button', { name: 'Marker', exact: true }).click();
  await map.click({ position: { x: 640, y: 320 }, delay: 300 });
  await expect(page.locator('.wg-marker-card')).toHaveCount(1);
  // The finished label must stop pointer events even while drawing is active.
  await distance.click();
  await labels
    .first()
    .getByRole('button', { name: 'Remove measurement' })
    .click();
  await expect(labels).toHaveCount(1);
  await expect(page.locator('.wg-measure-label')).toHaveCount(1);
  await expect(page.locator('.wg-marker-card')).toHaveCount(1);
  await expect(distance).toHaveAttribute('aria-pressed', 'true');
  // Keyboard removal must work and return focus to the map.
  await labels.getByRole('button', { name: 'Remove measurement' }).focus();
  await page.keyboard.press('Enter');
  await expect(page.locator('.wg-measure-label')).toHaveCount(0);
  await expect(map).toBeFocused();
  await expect(page.locator('.wg-marker-card')).toHaveCount(1);
  // A marker's existing Remove control must not place another marker.
  await page.getByRole('button', { name: 'Marker', exact: true }).click();
  await page
    .locator('.wg-marker-card')
    .getByRole('button', { name: 'Remove', exact: true })
    .click();
  await expect(page.locator('.wg-marker-card')).toHaveCount(0);
});
test('clear cancels unfinished distance and area sketches and permits a new measurement', async ({
  page,
}) => {
  const map = page.locator('.wg-map');
  const clear = page.getByRole('button', { name: 'Clear map', exact: true });
  for (const name of ['Distance', 'Area']) {
    const tool = page.getByRole('button', { name, exact: true });
    await tool.click();
    await map.click({ position: { x: 410, y: 250 } });
    await expect(page.locator('.wg-measure-label')).toHaveCount(1);
    await expect(page.locator('.wg-measure-label--finished')).toHaveCount(0);
    await clear.click();
    await expect(page.locator('.wg-measure-label')).toHaveCount(0);
    await expect(tool).toHaveAttribute('aria-pressed', 'false');
  }
  await page.getByRole('button', { name: 'Distance', exact: true }).click();
  await map.click({ position: { x: 410, y: 250 } });
  await map.dblclick({ position: { x: 550, y: 280 } });
  await expect(page.locator('.wg-measure-label--finished')).toHaveCount(1);
  await clear.click();
  await clear.click();
  await expect(page.locator('.wg-measure-label')).toHaveCount(0);
});
test('coordinate entry validates input and moves to a marker', async ({
  page,
}) => {
  await page.getByRole('button', { name: 'Coordinates', exact: true }).click();
  const dialog = page.getByRole('dialog', { name: 'Coordinates', exact: true });
  await dialog
    .getByLabel('Enter coordinates', { exact: true })
    .fill('bad input');
  await dialog
    .getByRole('button', { name: 'Go to coordinates', exact: true })
    .click();
  await expect(dialog.getByRole('status')).toContainText('Accepted systems');
  await dialog
    .getByLabel('Enter coordinates', { exact: true })
    .fill('51.5, -0.1');
  await dialog
    .getByRole('button', { name: 'Go to coordinates', exact: true })
    .click();
  await expect(page.locator('.wg-marker-card')).toBeVisible();
  await expect(dialog).toBeHidden();
  await expect(
    page.getByRole('button', { name: 'Coordinates', exact: true }),
  ).toHaveAttribute('aria-expanded', 'false');
  await page
    .locator('.wg-marker-card')
    .getByRole('button', { name: 'Remove', exact: true })
    .click();
  await expect(page.locator('.wg-marker-card')).toHaveCount(0);
  await page.getByRole('button', { name: 'Home', exact: true }).click();
});
test('exports a real PNG with a visible basemap and marker', async ({
  page,
}) => {
  await page.getByRole('radio', { name: 'OpenStreetMap', exact: true }).check();
  await page.getByRole('button', { name: 'Marker', exact: true }).click();
  await page
    .locator('.wg-map')
    .click({ position: { x: 540, y: 340 }, delay: 300 });
  await expect(page.locator('.wg-marker-card')).toBeVisible();
  await page.keyboard.press('Escape');
  await page.getByRole('button', { name: 'Export map', exact: true }).click();
  const dialog = page.getByRole('dialog', { name: 'Export map', exact: true });
  const [download] = await Promise.all([
    page.waitForEvent('download'),
    dialog.getByRole('button', { name: 'Download PNG', exact: true }).click(),
  ]);
  await download.saveAs('test-results/demo-export.png');
  const png = fs.readFileSync('test-results/demo-export.png');
  expect(png.subarray(1, 4).toString()).toBe('PNG');
  expect(png.length).toBeGreaterThan(10000);
  expect(download.suggestedFilename()).toMatch(
    /^webgis-map_\d{4}-\d\d-\d\d_\d{4}\.png$/,
  );
});
test('mobile layout exposes the drawer and full-screen catalog', async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.getByRole('button', { name: 'Layers', exact: true }).click();
  await expect(page.locator('.wg-sidebar')).toBeVisible();
  await page
    .getByRole('checkbox', { name: 'Open thematic catalog', exact: true })
    .check();
  const panel = page.getByRole('dialog', {
    name: 'Thematic layers',
    exact: true,
  });
  await expect(panel).toBeVisible();
  const box = await panel.boundingBox();
  expect(box.width).toBeGreaterThan(380);
  await panel.getByRole('button', { name: 'Close', exact: true }).click();
});
