import { test, expect, vi } from 'vitest';
import Feature from 'ol/Feature.js';
import Point from 'ol/geom/Point.js';
import { toCql, fieldName, likePattern } from '../../src/core/data/cql.js';
import {
  createMemoryAdapter,
  matches,
} from '../../src/core/data/adapters/memory.js';
import { createGeoServerAdapter } from '../../src/core/data/adapters/geoserverCql.js';
import { createFesAdapter } from '../../src/core/data/adapters/fes.js';
import { createServices } from '../../src/core/map/services.js';
import { groupFeatures } from '../../src/core/data/queryResults.js';
import { csvText } from '../../src/core/ui/download.js';
const def = {
  id: 'places',
  source: { type: 'wms', service: 'main', layers: 'places' },
};
const data = {
  type: 'FeatureCollection',
  numberMatched: 1,
  features: [
    {
      type: 'Feature',
      id: 'p.1',
      properties: { name: 'Town' },
      geometry: { type: 'Point', coordinates: [0, 0] },
    },
  ],
};
const json = (value) =>
  new Response(JSON.stringify(value), {
    headers: { 'Content-Type': 'application/json' },
  });
test('CQL quotes values and identifiers independently', () => {
  expect(fieldName('city"name')).toBe('"city""name"');
  expect(toCql({ field: 'name', op: 'eq', value: "O'Connor" })).toBe(
    "name = 'O''Connor'",
  );
  expect(likePattern('10%_\\')).toBe('%10\\%\\_\\\\%');
  expect(
    toCql({
      and: [
        { field: 'a', op: 'gt', value: 'bad' },
        { field: 'b', op: 'isNull' },
      ],
    }),
  ).toBe('(b IS NULL)');
  expect(toCql({ field: 'a', op: 'in', value: [] })).toBe('EXCLUDE');
});
test('memory LIKE matches escaped wildcards and nested conditions', () => {
  expect(
    matches(
      { name: '10%_x' },
      { field: 'name', op: 'ilike', value: likePattern('10%_') },
    ),
  ).toBe(true);
  expect(
    matches(
      { name: '100x' },
      { field: 'name', op: 'ilike', value: likePattern('10%_') },
    ),
  ).toBe(false);
  expect(
    matches(
      { n: 8, a: null },
      {
        and: [
          { field: 'n', op: 'gte', value: 8 },
          {
            or: [
              { field: 'a', op: 'isNull' },
              { field: 'n', op: 'lt', value: 3 },
            ],
          },
        ],
      },
    ),
  ).toBe(true);
});
test('null comparisons agree between memory and CQL', () => {
  expect(matches({ a: null }, { field: 'a', op: 'neq', value: 1 })).toBe(false);
  expect(matches({ a: null }, { field: 'a', op: 'neq', value: null })).toBe(
    false,
  );
  expect(matches({ a: 1 }, { field: 'a', op: 'neq', value: null })).toBe(true);
  expect(toCql({ field: 'a', op: 'in', value: [1, null] })).toBe(
    '(a IN (1) OR a IS NULL)',
  );
});
test('memory filters sorts pages and projects without mutating originals', async () => {
  const features = [
    new Feature({ name: 'Z', n: 2, geometry: new Point([1, 2]) }),
    new Feature({ name: 'A', n: 3 }),
    new Feature({ name: null, n: 5 }),
  ];
  const adapter = createMemoryAdapter(() => ({
    ready: Promise.resolve(),
    layer: { getSource: () => ({ getFeatures: () => features }) },
  }));
  const result = await adapter.features(def, {
    where: { field: 'n', op: 'gte', value: 2 },
    sortBy: [{ field: 'name', dir: 'desc' }],
    limit: 2,
    offset: 1,
    properties: ['name'],
    withGeometry: false,
  });
  expect(result.total).toBe(3);
  expect(result.features.map((f) => f.get('name'))).toEqual(['A', null]);
  expect(result.features[0].getGeometry()).toBeUndefined();
  expect(features[0].getGeometry()).toBeDefined();
  expect((await adapter.describe(def)).fields).toContainEqual({
    name: 'n',
    type: 'number',
  });
});
test('memory queries honor cancellation', async () => {
  const adapter = createMemoryAdapter(() => ({
    ready: Promise.resolve(),
    layer: { getSource: () => ({ getFeatures: () => [] }) },
  }));
  const controller = new AbortController();
  controller.abort();
  await expect(
    adapter.features(def, { signal: controller.signal }),
  ).rejects.toMatchObject({ name: 'AbortError' });
});
test('GeoServer builds encoded WFS requests and reads total', async () => {
  const fetch = vi.fn(async () => json(data));
  vi.stubGlobal('fetch', fetch);
  const services = createServices({
    services: {
      main: {
        type: 'geoserver',
        url: 'https://example.com/geo',
        workspace: 'demo',
      },
    },
  });
  const adapter = createGeoServerAdapter(services, 'EPSG:3857');
  const result = await adapter.features(def, {
    where: { field: 'name', op: 'eq', value: "O'Connor" },
    limit: 10,
    offset: 20,
    sortBy: [{ field: 'name', dir: 'asc' }],
  });
  const url = new URL(fetch.mock.calls[0][0]);
  expect(url.searchParams.get('typeNames')).toBe('demo:places');
  expect(url.searchParams.get('CQL_FILTER')).toBe("name = 'O''Connor'");
  expect(url.searchParams.get('startIndex')).toBe('20');
  expect(result.total).toBe(1);
  expect(result.features[0].getId()).toBe('p.1');
  vi.unstubAllGlobals();
});
test('GeoServer retries natural order using a described field', async () => {
  let called = 0;
  const fetch = vi.fn(async (url) => {
    if (String(url).includes('DescribeFeatureType'))
      return json({
        featureTypes: [{ properties: [{ name: 'name', type: 'xsd:string' }] }],
      });
    if (called++ === 0)
      return new Response(
        '<ServiceExceptionReport><ServiceException>natural order requires a primary key</ServiceException></ServiceExceptionReport>',
      );
    return json(data);
  });
  vi.stubGlobal('fetch', fetch);
  const services = createServices({
    services: { main: { type: 'geoserver', url: 'https://example.com/geo' } },
  });
  const result = await createGeoServerAdapter(services, 'EPSG:3857').features(
    def,
    { limit: 100, offset: 100 },
  );
  expect(result.total).toBe(1);
  expect(new URL(fetch.mock.calls.at(-1)[0]).searchParams.get('sortBy')).toBe(
    'name A',
  );
  vi.unstubAllGlobals();
});
test('FES emits XML with safe literals namespace paging and sorting', async () => {
  let posted = '';
  const fetch = vi.fn(async (_url, options) => {
    if (options.method === 'POST') {
      posted = options.body;
      return json(data);
    }
    return new Response(
      '<xsd:schema xmlns:xsd="http://www.w3.org/2001/XMLSchema" targetNamespace="https://example.com/demo"><xsd:complexType name="placesType"><xsd:sequence><xsd:element name="name" type="xsd:string"/><xsd:element name="geom" type="gml:PointPropertyType"/></xsd:sequence></xsd:complexType></xsd:schema>',
    );
  });
  vi.stubGlobal('fetch', fetch);
  const services = createServices({
    services: {
      main: { type: 'wfs', url: 'https://example.com/ows', workspace: 'demo' },
    },
  });
  const result = await createFesAdapter(services, 'EPSG:3857').features(def, {
    where: { field: 'name', op: 'ilike', value: '%A&B%' },
    limit: 10,
    offset: 2,
    sortBy: [{ field: 'name', dir: 'desc' }],
  });
  expect(
    new DOMParser()
      .parseFromString(posted, 'text/xml')
      .getElementsByTagNameNS('*', 'Literal')[0].textContent,
  ).toBe('%A&B%');
  expect(posted).toContain('matchCase="false"');
  expect(posted).toContain('count="10"');
  expect(posted).toContain('startIndex="2"');
  expect(posted).toContain('DESC');
  expect(result.total).toBe(1);
  vi.unstubAllGlobals();
});
test('grouping keeps original rows and collapses to a representative point', () => {
  const rows = [
    new Feature({ key: 'one', name: 'a', geometry: new Point([2, 3]) }),
    new Feature({ key: 'one', name: 'b' }),
  ];
  const grouped = groupFeatures(rows, { field: 'key' });
  expect(grouped).toHaveLength(1);
  expect(grouped[0].get('_wgRows')).toEqual(rows);
  expect(grouped[0].getGeometry().getCoordinates()).toEqual([2, 3]);
});
test('CSV has BOM escapes quotes and neutralizes formulas', () => {
  expect(
    csvText(
      [{ name: 'a' }],
      [new Feature({ a: '=1+1' }), new Feature({ a: 'say "hello"' })],
    ),
  ).toBe('\uFEFF"a"\r\n"\'=1+1"\r\n"say ""hello"""');
});
test('FES speaks WFS 1.1 to servers that set wfsVersion (QGIS Server)', async () => {
  let posted = '';
  let described = '';
  const fetch = vi.fn(async (url, options) => {
    if (options?.method === 'POST') {
      posted = options.body;
      return json(data);
    }
    described = String(url);
    return new Response(
      '<xsd:schema xmlns:xsd="http://www.w3.org/2001/XMLSchema" targetNamespace="http://www.qgis.org/gml"><xsd:complexType name="placesType"><xsd:sequence><xsd:element name="name" type="xsd:string"/><xsd:element name="geometry" type="gml:PointPropertyType"/></xsd:sequence></xsd:complexType></xsd:schema>',
    );
  });
  vi.stubGlobal('fetch', fetch);
  const services = createServices({
    services: {
      main: {
        type: 'wfs',
        url: 'https://example.com/ows',
        wfsVersion: '1.1.0',
      },
    },
  });
  await createFesAdapter(services, 'EPSG:3857').features(def, {
    where: { field: 'name', op: 'ilike', value: '%Sof%' },
    limit: 10,
    sortBy: [{ field: 'name', dir: 'asc' }],
  });
  expect(new URL(described).searchParams.get('version')).toBe('1.1.0');
  expect(new URL(described).searchParams.get('typeName')).toBe('places');
  expect(posted).toContain('version="1.1.0"');
  expect(posted).toContain('maxFeatures="10"');
  expect(posted).not.toContain('fes:');
  expect(posted).toContain('ogc:PropertyName');
  expect(posted).toContain('ogc:SortBy');
  vi.unstubAllGlobals();
});
