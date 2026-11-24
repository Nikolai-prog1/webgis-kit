// @vitest-environment node
import { test, expect } from 'vitest';
import proj4 from 'proj4';
import { resolveCrs, projectedBbox } from '../../tools/crs.mjs';
import { basemapHosts } from '../../tools/smoke.mjs';

test('known and UTM systems resolve offline with projected bounds', async () => {
  const bgs = await resolveCrs('EPSG:7801');
  expect(bgs.kind).toBe('projected');
  expect(bgs.worldBbox).toEqual([22.36, 41.24, 28.68, 44.23]);
  // Sofia (PROJ: E 320933.85, N 4730074.37) lies inside the computed bounds.
  proj4.defs('EPSG:7801', bgs.proj4);
  const [x, y] = proj4('EPSG:4326', 'EPSG:7801', [23.3147, 42.6853]);
  expect(x).toBeCloseTo(320933.85, 0);
  expect(y).toBeCloseTo(4730074.37, 0);
  expect(x > bgs.bbox[0] && x < bgs.bbox[2]).toBe(true);
  const utm = await resolveCrs('32735');
  expect(utm.proj4).toContain('+zone=35 +south');
  expect(utm.worldBbox).toEqual([24, -80, 30, 0]);
});

test('a system without an EPSG code needs a code and an area', async () => {
  const local =
    '+proj=sterea +lat_0=42.5 +lon_0=25 +k=0.9999 +x_0=500000 +y_0=4700000 +ellps=GRS80 +units=m +no_defs';
  await expect(resolveCrs(local)).rejects.toThrow('--code');
  await expect(resolveCrs(local, { code: 'LOCAL:1' })).rejects.toThrow(
    '--area',
  );
  const item = await resolveCrs(local, {
    code: 'LOCAL:1',
    area: [22, 41, 29, 44.5],
  });
  expect(item.bbox[0]).toBeLessThan(500000);
  expect(
    projectedBbox('LOCAL:1', [24.9, 42.4, 25.1, 42.6]).every(Number.isFinite),
  ).toBe(true);
});

test('smoke knows which hosts serve basemaps', () => {
  expect(
    basemapHosts({
      basemaps: {
        items: [
          { type: 'osm' },
          {
            type: 'xyz',
            url: 'https://{a-c}.tiles.example.org/{z}/{x}/{y}.png',
          },
          { type: 'wms', url: 'geoserver/wms' },
        ],
      },
    }),
  ).toEqual(new Set(['tile.openstreetmap.org', 'a.tiles.example.org']));
});
