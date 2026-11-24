import { test, expect } from 'vitest';
import proj4 from 'proj4';
import { register } from 'ol/proj/proj4.js';
import { get, getPointResolution, fromLonLat } from 'ol/proj.js';
import View from 'ol/View.js';
import { zoomIn } from '../../src/core/map/createMap.js';
import { resolveCrs } from '../../tools/crs.mjs';

test('Web Mercator zoom levels keep their ground scale in a national projection', async () => {
  const bgs = await resolveCrs('EPSG:7801');
  proj4.defs(bgs.code, bgs.proj4);
  register(proj4);
  get(bgs.code).setExtent(bgs.bbox);
  const sofia = [23.3147, 42.6853];
  expect(zoomIn('EPSG:3857', 14, sofia)).toBe(14);
  for (const zoom of [8, 14, 18]) {
    const converted = zoomIn(bgs.code, zoom, sofia);
    const view = new View({ projection: bgs.code });
    const ground =
      view.getResolutionForZoom(converted) *
      getPointResolution(bgs.code, 1, fromLonLat(sofia, bgs.code), 'm');
    const expected =
      (156543.03392804097 / 2 ** zoom) * Math.cos((sofia[1] * Math.PI) / 180);
    expect(ground / expected).toBeCloseTo(1, 3);
  }
});
