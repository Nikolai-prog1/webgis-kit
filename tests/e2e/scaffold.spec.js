import { test, expect } from '@playwright/test';
test('renders a map canvas', async ({ page }) => {
  await page.route('https://**/*', (route) => route.abort());
  await page.goto('/');
  await expect(page.locator('.ol-viewport')).toBeVisible();
});
test('switches language and exposes a readable configuration error', async ({
  page,
}) => {
  await page.goto('/');
  await page.getByLabel('Language', { exact: true }).selectOption('bg');
  await expect(page.getByLabel('Език', { exact: true })).toBeVisible();
  await page.route('**/config/app.json', (route) =>
    route.fulfill({
      json: {
        version: 99,
        app: { id: 'bad' },
        map: { center: [0, 0], zoom: 2 },
      },
    }),
  );
  await page.reload();
  await expect(page.getByRole('alert')).toContainText('version: expected 1');
});
