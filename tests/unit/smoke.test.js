// @vitest-environment node
import { test, expect, vi } from 'vitest';
import { checkLayers } from '../../tools/smoke.mjs';
test('smoke verifies workspace PNG and geographic WFS for a configured vector layer', async () => {
  const fetcher = vi.fn(async (url) => {
    const request = new URL(url);
    if (request.pathname.endsWith('/wms'))
      return new Response(new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10]), {
        headers: { 'content-type': 'image/png' },
      });
    return new Response('{"type":"FeatureCollection","features":[]}');
  });
  const checked = await checkLayers(
    {
      version: 1,
      app: { id: 'fixture', title: 'Fixture' },
      services: {
        main: { type: 'geoserver', url: 'geoserver', workspace: 'fixture' },
      },
      layers: [
        {
          id: 'places',
          source: { type: 'wms', service: 'main', layers: 'places' },
        },
      ],
    },
    'http://localhost:9999/',
    fetcher,
  );
  expect(checked).toHaveLength(2);
  expect(new URL(fetcher.mock.calls[0][0]).pathname).toBe(
    '/geoserver/fixture/wms',
  );
  expect(new URL(fetcher.mock.calls[1][0]).searchParams.get('srsName')).toBe(
    'EPSG:4326',
  );
});
test('smoke rejects HTTP-success OGC exceptions and missing vector data', async () => {
  const config = {
    version: 1,
    app: { id: 'fixture', title: 'Fixture' },
    layers: [
      { id: 'places', source: { type: 'geojson', url: 'missing.geojson' } },
    ],
  };
  await expect(
    checkLayers(
      config,
      'http://localhost/',
      async () => new Response('', { status: 404 }),
    ),
  ).rejects.toThrow('HTTP 404');
  config.services = { main: { type: 'geoserver', url: 'geoserver' } };
  config.layers = [
    {
      id: 'places',
      source: { type: 'wms', service: 'main', layers: 'places' },
    },
  ];
  await expect(
    checkLayers(
      config,
      'http://localhost/',
      async () =>
        new Response('<ServiceException>Error</ServiceException>', {
          headers: { 'content-type': 'application/xml' },
        }),
    ),
  ).rejects.toThrow('no valid PNG');
});
