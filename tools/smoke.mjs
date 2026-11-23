import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawn, spawnSync } from 'node:child_process';
import { freePort, waitFor } from './stack/common.mjs';
import { normalize, allLayerDefs } from '../src/core/config/normalize.js';
import { createServices } from '../src/core/map/services.js';

const root = fileURLToPath(new URL('../', import.meta.url));
export async function checkLayers(config, base, fetcher = fetch) {
  const catalogs = {};
  for (const cat of config.catalogs || [])
    if (cat.src) {
      const response = await fetcher(new URL(cat.src, base));
      if (!response.ok)
        throw new Error(`Catalog ${cat.id}: HTTP ${response.status}`);
      catalogs[cat.id] = await response.json();
    }
  const normalized = normalize(config, catalogs),
    services = createServices(normalized, base),
    checked = [];
  for (const layer of allLayerDefs(normalized)) {
    const source = layer.source;
    if (source.type === 'geojson') {
      const response = await fetcher(new URL(source.url, base));
      if (!response.ok)
        throw new Error(`GeoJSON ${layer.id}: HTTP ${response.status}`);
      const data = await response.json();
      if (!['FeatureCollection', 'Feature'].includes(data.type))
        throw new Error(`GeoJSON ${layer.id}: unreadable feature data`);
      checked.push({ id: layer.id, operation: 'GeoJSON' });
    }
    if (source.type === 'wms') {
      const service = services.get(source.service),
        version = service.wmsVersion || '1.1.1';
      let extent = [...(layer.extent || [-180, -85, 180, 85])];
      for (const [low, high] of [
        [0, 2],
        [1, 3],
      ])
        if (extent[low] === extent[high]) {
          extent[low] -= 0.001;
          extent[high] += 0.001;
        }
      if (version === '1.3.0')
        extent = [extent[1], extent[0], extent[3], extent[2]];
      const url = new URL(services.wmsUrl(source.service));
      const params = {
        SERVICE: 'WMS',
        REQUEST: 'GetMap',
        VERSION: version,
        LAYERS: services.qualified(source.service, source.layers),
        STYLES: source.style || '',
        FORMAT: 'image/png',
        WIDTH: '64',
        HEIGHT: '64',
        BBOX: extent.join(','),
        [version === '1.3.0' ? 'CRS' : 'SRS']: 'EPSG:4326',
      };
      for (const [key, value] of Object.entries(params))
        url.searchParams.set(key, value);
      const response = await fetcher(url);
      const bytes = new Uint8Array(await response.arrayBuffer());
      if (
        !response.ok ||
        !response.headers.get('content-type')?.startsWith('image/') ||
        ![137, 80, 78, 71, 13, 10, 26, 10].every(
          (value, index) => bytes[index] === value,
        )
      )
        throw new Error(
          `WMS ${layer.id}: no valid PNG (HTTP ${response.status})`,
        );
      checked.push({ id: layer.id, operation: 'WMS GetMap' });
    }
    const query = layer.query;
    if (
      source.type === 'wfs' ||
      (query &&
        (config.layers?.find((def) => def.id === layer.id)?.query ||
          services.get(query.service).type === 'geoserver'))
    ) {
      const service = source.type === 'wfs' ? source.service : query.service;
      const url = new URL(services.wfsUrl(service));
      for (const [key, value] of Object.entries({
        service: 'WFS',
        version: '2.0.0',
        request: 'GetFeature',
        typeNames: services.qualified(
          service,
          source.type === 'wfs' ? source.typeName : query.typeName,
        ),
        count: '1',
        srsName: 'EPSG:4326',
        outputFormat: 'application/json',
      }))
        url.searchParams.set(key, value);
      let response = await fetcher(url),
        text = await response.text();
      if (!response.ok) {
        url.searchParams.delete('outputFormat');
        response = await fetcher(url);
        text = await response.text();
      }
      if (
        !response.ok ||
        /<(?:\w+:)?(?:ServiceException|ExceptionText)\b/.test(text)
      )
        throw new Error(
          `WFS ${layer.id}: failed query (HTTP ${response.status})`,
        );
      if (text.trim().startsWith('{')) {
        if (JSON.parse(text).type !== 'FeatureCollection')
          throw new Error(`WFS ${layer.id}: unreadable GeoJSON`);
      } else if (!/<(?:\w+:)?FeatureCollection\b/.test(text))
        throw new Error(`WFS ${layer.id}: unreadable GML`);
      checked.push({ id: layer.id, operation: 'WFS GetFeature' });
    }
  }
  return checked;
}
export async function smoke(args = process.argv.slice(2)) {
  let instance = process.env.WEBGIS_APP_DIR || path.join(root, 'app'),
    httpOnly = false,
    screenshot;
  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--http-only') httpOnly = true;
    else if (args[i] === '--instance' && args[i + 1]) instance = args[++i];
    else if (args[i] === '--screenshot' && args[i + 1]) screenshot = args[++i];
    else
      throw new Error(
        'Usage: npm run smoke -- [--instance <dir>] [--http-only] [--screenshot <file>]',
      );
  }
  instance = path.resolve(instance);
  const output = path.join(
    instance,
    '.webgis/smoke-build',
    `${Date.now()}-${process.pid}`,
  );
  const env = { ...process.env, WEBGIS_APP_DIR: instance };
  const vite = path.join(root, 'node_modules/vite/bin/vite.js');
  const build = spawnSync(
    process.execPath,
    [vite, 'build', '--outDir', output],
    { cwd: root, env, encoding: 'utf8', windowsHide: true },
  );
  if (build.status !== 0)
    throw new Error(
      'Build failed before smoke: ' + (build.stderr || build.stdout),
    );
  const port = await freePort(4173),
    base = `http://127.0.0.1:${port}/`;
  const server = spawn(
    process.execPath,
    [
      vite,
      'preview',
      '--host',
      '127.0.0.1',
      '--port',
      String(port),
      '--strictPort',
      '--outDir',
      output,
    ],
    { cwd: root, env, stdio: 'pipe', windowsHide: true },
  );
  let serverLog = '';
  server.stderr.on('data', (data) => (serverLog += data.toString()));
  let browser;
  try {
    await waitFor(
      async () => (await fetch(base, { signal: AbortSignal.timeout(2000) })).ok,
      'Vite preview',
      30,
    );
    const configResponse = await fetch(new URL('config/app.json', base));
    if (!configResponse.ok)
      throw new Error('Preview configuration did not load.');
    const config = await configResponse.json();
    const checked = await checkLayers(config, base);
    if (!httpOnly) {
      let chromium;
      try {
        ({ chromium } = await import('@playwright/test'));
      } catch {
        console.log(
          'Playwright unavailable: HTTP checks only; visual inspection remains for the user.',
        );
      }
      if (chromium) {
        try {
          browser = await chromium.launch({ headless: true });
        } catch (error) {
          if (!/executable|install|browser.*not found/i.test(error.message))
            throw error;
          console.log(
            'Chromium unavailable: HTTP checks only; run npx playwright install chromium for browser verification.',
          );
        }
      }
      if (browser) {
        const page = await browser.newPage({
            viewport: { width: 1280, height: 800 },
            reducedMotion: 'reduce',
          }),
          errors = [];
        page.on('pageerror', (error) => errors.push(error.message));
        page.on('console', (message) => {
          if (message.type() === 'error') errors.push(message.text());
        });
        await page.goto(base, { waitUntil: 'networkidle' });
        await page.locator('.ol-viewport').waitFor();
        await page
          .locator('.wg-loading')
          .waitFor({ state: 'hidden', timeout: 30000 });
        if (await page.locator('.wg-toast--error').count())
          errors.push(await page.locator('.wg-toast--error').allTextContents());
        if (errors.length)
          throw new Error('Browser errors: ' + JSON.stringify(errors));
        if (screenshot) {
          fs.mkdirSync(path.dirname(path.resolve(screenshot)), {
            recursive: true,
          });
          await page.screenshot({ path: screenshot, fullPage: true });
        }
        console.log('Browser: map rendered; no console/page errors.');
      }
    }
    console.log(
      `Smoke passed: ${checked.length} layer/service checks${browser ? ' and Chromium' : ' (HTTP only; visual inspection is not verified)'}.`,
    );
    for (const item of checked) console.log(`  ${item.id}: ${item.operation}`);
    return { checked, browser: !!browser };
  } catch (error) {
    if (server.exitCode) console.error(serverLog);
    throw error;
  } finally {
    if (browser) await browser.close();
    server.kill('SIGTERM');
    await new Promise((resolve) => {
      if (server.exitCode !== null) resolve();
      else server.once('exit', resolve);
    });
  }
}
if (
  process.argv[1] &&
  path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)
)
  smoke().catch((error) => {
    console.error('Smoke failed: ' + error.message);
    process.exitCode = 1;
  });
