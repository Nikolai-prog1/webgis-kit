import { test, expect } from 'vitest';
import { createCrs } from '../../src/core/map/projections.js';
import { distanceLabel, areaLabel } from '../../src/core/map/units.js';
const crs = () =>
  createCrs({
    map: {},
    crs: [
      { code: 'EPSG:4326', kind: 'geographic' },
      {
        code: 'EPSG:7801',
        kind: 'projected',
        axisOrder: 'ne',
        bbox: [236773.58, 4567229.48, 990127.3, 4915558.57],
        worldBbox: [22.36, 41.24, 28.68, 44.23],
        proj4:
          '+proj=lcc +lat_1=42 +lat_2=43.3333333333333 +lat_0=42.6678756833333 +lon_0=25.5 +x_0=500000 +y_0=4725824.3591 +ellps=GRS80 +units=m +no_defs',
      },
    ],
  });
test.each(['X=4725824.3591 Y=500000', '500000 4725824.3591'])(
  'detects projected axes for %s',
  (text) => {
    const parsed = crs().parse(text);
    expect(parsed.code).toBe('EPSG:7801');
    expect(parsed.values).toEqual([500000, 4725824.3591]);
  },
);
test('geographic coordinate ordering uses configured area bounds', () => {
  expect(crs().parse('23.3219 42.6977').values).toEqual([23.3219, 42.6977]);
  expect(crs().parse('0 0')).toBeNull();
});
test('measurement units adapt to magnitude', () => {
  expect(distanceLabel(1500, 'en')).toBe('1.5 km');
  expect(areaLabel(20000, 'en')).toBe('2 ha');
  expect(areaLabel(2000000, 'en')).toBe('2 km²');
});
