import fs from 'node:fs';
const xml = fs.readFileSync('tests/fixtures/capabilities-1.3.xml', 'utf8');
const pixel = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAAC0lEQVR42mNgAAIAAAUAAen63NgAAAAASUVORK5CYII=',
  'base64',
);
export async function offline(page) {
  await page.route('**/*', async (route) => {
    const url = new URL(route.request().url());
    if (['127.0.0.1', 'localhost'].includes(url.hostname))
      return route.continue();
    if (/getcapabilities/i.test(url.search))
      return route.fulfill({
        status: 200,
        contentType: 'text/xml',
        body: xml,
        headers: { 'Access-Control-Allow-Origin': '*' },
      });
    return route.fulfill({
      status: 200,
      contentType: 'image/png',
      body: pixel,
      headers: { 'Access-Control-Allow-Origin': '*' },
    });
  });
}
