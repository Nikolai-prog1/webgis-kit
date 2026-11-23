import { test, expect } from 'vitest';
import fs from 'node:fs';
import { zIndex } from '../../src/core/map/zIndex.js';
import { createServices } from '../../src/core/map/services.js';
import { resolveUrl } from '../../src/core/config/urls.js';
import { createToolManager } from '../../src/core/map/toolManager.js';
import { createHooks } from '../../src/core/app/hooks.js';
import { createCrs } from '../../src/core/map/projections.js';
import {
  emptyException,
  wmsImageResponse,
} from '../../src/core/map/layerFactory.js';
test('z-order reserves bands and honors explicit zero', () => {
  expect(zIndex({ zIndex: 0 })).toBe(0);
  expect(zIndex({ catalogId: 'a', geometry: 'polygon' })).toBe(200);
  expect(zIndex({ catalogId: 'a', geometry: 'line' })).toBe(300);
  expect(zIndex({})).toBe(1000);
});
test('service URLs honor subfolders and style-independent qualification', () => {
  const services = createServices(
    {
      services: {
        a: { type: 'geoserver', url: 'geoserver', workspace: 'demo' },
        b: { type: 'wms', url: 'proxy/ows' },
      },
    },
    'https://example.com/gis/',
  );
  expect(services.wmsUrl('a')).toBe(
    'https://example.com/gis/geoserver/demo/wms',
  );
  expect(services.wmsUrl('b')).toBe('https://example.com/gis/proxy/ows');
  expect(services.qualified('a', 'cities')).toBe('demo:cities');
  expect(services.qualified('a', 'other:cities')).toBe('other:cities');
});

test('GeoServer scopes every endpoint once and preserves global and plain services', () => {
  const services = createServices({
    services: {
      scoped: {
        type: 'geoserver',
        url: 'https://example.com/geoserver/',
        workspace: 'demo',
      },
      explicit: {
        type: 'geoserver',
        url: 'https://example.com/geoserver/demo/wms',
        workspace: 'demo',
      },
      encoded: {
        type: 'geoserver',
        url: 'https://example.com/geoserver',
        workspace: 'demo space',
      },
      global: { type: 'geoserver', url: 'https://example.com/geoserver' },
      plain: { type: 'wms', url: 'https://example.com/ows', workspace: 'demo' },
    },
  });
  for (const id of ['scoped', 'explicit']) {
    expect(services.wmsUrl(id)).toBe('https://example.com/geoserver/demo/wms');
    expect(services.wfsUrl(id)).toBe('https://example.com/geoserver/demo/wfs');
  }
  expect(services.wmsUrl('encoded')).toBe(
    'https://example.com/geoserver/demo%20space/wms',
  );
  expect(services.wfsUrl('global')).toBe('https://example.com/geoserver/wfs');
  expect(services.wmsUrl('plain')).toBe('https://example.com/ows');
});
test('XYZ placeholders survive URL resolution', () =>
  expect(resolveUrl('tiles/{z}/{x}/{y}.png', 'https://example.com/gis/')).toBe(
    'https://example.com/gis/tiles/{z}/{x}/{y}.png',
  ));
test('exclusive tool activation deactivates the previous tool', () => {
  const manager = createToolManager(createHooks());
  const calls = [];
  manager.register({
    id: 'a',
    onActivate: () => calls.push('a+'),
    onDeactivate: () => calls.push('a-'),
  });
  manager.register({ id: 'b', onActivate: () => calls.push('b+') });
  manager.activate('a');
  manager.activate('b');
  expect(calls).toEqual(['a+', 'a-', 'b+']);
  expect(manager.active()).toBe('b');
  manager.activate('b');
  expect(manager.active()).toBeNull();
});
test.each(['42.6977, 23.3219', '42,6977 23,3219', '42.6977°N 23.3219°E'])(
  'coordinate parser supports %s',
  (text) => {
    const crs = createCrs({
      map: {},
      crs: [{ code: 'EPSG:4326', kind: 'geographic' }],
    });
    expect(crs.parse(text).values).toEqual([23.3219, 42.6977]);
  },
);
test('coordinate parser rejects invalid latitudes and extra values', () => {
  const crs = createCrs({
    map: {},
    crs: [{ code: 'EPSG:4326', kind: 'geographic' }],
  });
  expect(crs.parse('190 191')).toBeNull();
  expect(crs.parse('1 2 3')).toBeNull();
});
test('coordinate parser honors western/southern hemispheres and comma-separated integers', () => {
  const crs = createCrs({
    map: {},
    crs: [{ code: 'EPSG:4326', kind: 'geographic' }],
  });
  expect(crs.parse('33.86°S 151.2°E').values).toEqual([151.2, -33.86]);
  expect(crs.parse('0.1°W 51.5°N').values).toEqual([-0.1, 51.5]);
  expect(crs.parse('42,23').values).toEqual([23, 42]);
});

test('custom projected bounds take priority over the broad Web Mercator fallback', () => {
  const example = JSON.parse(
    fs.readFileSync(
      'examples/configs/bulgaria-crs/static/config/app.json',
      'utf8',
    ),
  );
  example.crs.splice(1, 0, {
    code: 'EPSG:3857',
    kind: 'projected',
    bbox: [-20037508, -20037508, 20037508, 20037508],
  });
  const crs = createCrs(example);
  const first = crs.parse('4725824.3591 500000');
  const reversed = crs.parse('500000 4725824.3591');
  expect(first.code).toBe('EPSG:7801');
  expect(reversed.code).toBe('EPSG:7801');
  expect(first.coordinate).toEqual(reversed.coordinate);
  const roundTrip = crs.parse(crs.format(first.coordinate, 'EPSG:7801'));
  expect(roundTrip.code).toBe('EPSG:7801');
  expect(roundTrip.coordinate[0]).toBeCloseTo(first.coordinate[0], 1);
  expect(roundTrip.coordinate[1]).toBeCloseTo(first.coordinate[1], 1);
});
test('configured image exceptions are explicit and case insensitive', () => {
  expect(
    emptyException('<ServiceException>No data</ServiceException>', ['no data']),
  ).toBe(true);
  expect(emptyException('Authentication failed', ['no data'])).toBe(false);
});
test('empty image exceptions work with failing HTTP statuses without masking other errors', async () => {
  expect(
    await wmsImageResponse(
      new Response('<ServiceException>No data</ServiceException>', {
        status: 500,
      }),
      ['no data'],
    ),
  ).toBeNull();
  await expect(
    wmsImageResponse(new Response('Access denied', { status: 403 }), [
      'no data',
    ]),
  ).rejects.toThrow('Expected a WMS image');
});
