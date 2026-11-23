import { test, expect, vi, afterEach } from 'vitest';
import { createGeoServerAdapter } from '../../src/core/data/adapters/geoserverCql.js';
import { createFesAdapter } from '../../src/core/data/adapters/fes.js';
import { createServices } from '../../src/core/map/services.js';
import { createLayerFactory } from '../../src/core/map/layerFactory.js';
import { get, toLonLat } from 'ol/proj.js';
import { readWfsGeoJSON } from '../../src/core/data/wfsGeoJSON.js';

const polar = {
  type: 'FeatureCollection',
  numberMatched: 1,
  features: [
    {
      type: 'Feature',
      properties: { name: 'Polar fixture' },
      geometry: {
        type: 'Polygon',
        coordinates: [
          [
            [-10, -90],
            [10, -90],
            [10, -80],
            [-10, -80],
            [-10, -90],
          ],
        ],
      },
    },
  ],
};
const schema =
  '<xsd:schema xmlns:xsd="http://www.w3.org/2001/XMLSchema" targetNamespace="https://example.com/demo"><xsd:complexType name="placesType"><xsd:sequence><xsd:element name="name" type="xsd:string"/><xsd:element name="geom" type="gml:PolygonPropertyType"/></xsd:sequence></xsd:complexType></xsd:schema>';
afterEach(() => vi.unstubAllGlobals());

test.each(['cql', 'fes'])(
  '%s requests geographic GeoJSON and safely projects a polar polygon',
  async (kind) => {
    const fetch = vi.fn(async (url) =>
      String(url).includes('DescribeFeatureType')
        ? new Response(schema)
        : new Response(JSON.stringify(polar)),
    );
    vi.stubGlobal('fetch', fetch);
    const services = createServices({
      services: {
        main: {
          type: kind === 'cql' ? 'geoserver' : 'wfs',
          url: 'https://example.com/geo',
          workspace: 'demo',
        },
      },
    });
    const adapter = (
      kind === 'cql' ? createGeoServerAdapter : createFesAdapter
    )(services, 'EPSG:3857');
    const result = await adapter.features(
      { id: 'places', source: { service: 'main', layers: 'places' } },
      { limit: 100 },
    );
    if (kind === 'cql')
      expect(new URL(fetch.mock.calls[0][0]).searchParams.get('srsName')).toBe(
        'EPSG:4326',
      );
    else
      expect(fetch.mock.calls.at(-1)[1].body).toContain('srsName="EPSG:4326"');
    const coordinates = result.features[0]
      .getGeometry()
      .getCoordinates()
      .flat(2);
    expect(coordinates.every(Number.isFinite)).toBe(true);
    const extent = result.features[0].getGeometry().getExtent();
    expect(extent[1]).toBeLessThan(-10000000);
    expect(Math.abs(extent[1])).toBeLessThanOrEqual(20037509);
  },
);

test.each(['all', 'bbox'])(
  'WFS %s loading uses geographic data and an explicitly geographic bbox',
  async (strategy) => {
    const fetch = vi.fn(async () => new Response(JSON.stringify(polar)));
    vi.stubGlobal('fetch', fetch);
    const projection = get('EPSG:3857');
    const ctx = {
      view: { getProjection: () => projection },
      localized: (value) => value,
      t: (key) => key,
      services: createServices({
        services: {
          main: {
            type: 'geoserver',
            url: 'https://example.com/geo',
            workspace: 'demo',
          },
        },
      }),
      ui: { loading: { begin() {}, end() {} }, toast: vi.fn() },
    };
    const result = createLayerFactory(ctx).create({
      id: 'remote',
      title: 'Remote',
      geometry: 'polygon',
      source: { type: 'wfs', service: 'main', typeName: 'places', strategy },
    });
    const source = result.layer.getSource();
    if (strategy === 'bbox')
      source.loadFeatures(
        [0, 0, 1113194.9079327357, 1118889.9748579597],
        1,
        projection,
      );
    else await result.ready;
    await vi.waitFor(() => expect(source.getFeatures()).toHaveLength(1));
    const url = new URL(fetch.mock.calls[0][0]);
    expect(url.searchParams.get('srsName')).toBe('EPSG:4326');
    if (strategy === 'bbox') {
      const bbox = url.searchParams.get('bbox').split(',');
      expect(bbox[4]).toBe('EPSG:4326');
      expect(Number(bbox[2])).toBeCloseTo(10);
      expect(Number(bbox[3])).toBeCloseTo(10);
    }
    expect(
      source.getFeatures()[0].getGeometry().getExtent()[1],
    ).toBeGreaterThanOrEqual(-20037509);
  },
);

test('polar display clipping does not mutate data and supports geometry collections', () => {
  const original = structuredClone(polar);
  original.features[0].geometry = {
    type: 'GeometryCollection',
    geometries: [
      original.features[0].geometry,
      { type: 'Point', coordinates: [0, 90, 12] },
    ],
  };
  const snapshot = structuredClone(original);
  const [feature] = readWfsGeoJSON(original, 'EPSG:3857');
  expect(feature.getGeometry().getExtent().every(Number.isFinite)).toBe(true);
  expect(feature.getGeometry().getExtent()[3]).toBeLessThanOrEqual(20037509);
  expect(original).toEqual(snapshot);
});

const gmlOnlyException =
  '<?xml version="1.0" encoding="UTF-8"?><ows:ExceptionReport xmlns:ows="http://www.opengis.net/ows/1.1" version="2.0.0"><ows:Exception exceptionCode="InvalidParameterValue" locator="outputformat"><ows:ExceptionText>WFS server error. \'application/json\' is not a permitted output format for layer \'places\'.</ows:ExceptionText></ows:Exception></ows:ExceptionReport>';
// Lat/lon axis order, as WFS 2.0 servers such as MapServer return for EPSG:4326.
const gml32 = `<?xml version="1.0" encoding="UTF-8"?>
<wfs:FeatureCollection xmlns:wfs="http://www.opengis.net/wfs/2.0" xmlns:gml="http://www.opengis.net/gml/3.2" xmlns:demo="https://example.com/demo" numberMatched="unknown" numberReturned="2">
  <wfs:member><demo:places gml:id="places.1"><demo:geom><gml:Point gml:id="p1" srsName="urn:ogc:def:crs:EPSG::4326"><gml:pos>-34.5 -58.25</gml:pos></gml:Point></demo:geom><demo:name>Fixture City</demo:name></demo:places></wfs:member>
  <wfs:member><demo:places gml:id="places.2"><demo:geom><gml:Polygon gml:id="p2" srsName="urn:ogc:def:crs:EPSG::4326"><gml:exterior><gml:LinearRing><gml:posList>-90 -10 -90 10 -80 10 -80 -10 -90 -10</gml:posList></gml:LinearRing></gml:exterior></gml:Polygon></demo:geom><demo:name>Polar fixture</demo:name></demo:places></wfs:member>
</wfs:FeatureCollection>`;
test('FES falls back to GML when GeoJSON output is refused, keeps axis order and clips poles', async () => {
  const posts = [];
  const fetch = vi.fn(async (url, options = {}) => {
    if (String(url).includes('DescribeFeatureType'))
      return new Response(schema);
    posts.push(options.body);
    return new Response(
      options.body.includes('outputFormat=') ? gmlOnlyException : gml32,
    );
  });
  vi.stubGlobal('fetch', fetch);
  const services = createServices({
    services: { main: { type: 'wfs', url: 'https://example.com/ows' } },
  });
  const adapter = createFesAdapter(services, 'EPSG:3857');
  const def = {
    id: 'places',
    source: { service: 'main', layers: 'demo:places' },
  };
  const result = await adapter.features(def, { limit: 10 });
  expect(posts).toHaveLength(2);
  expect(posts[0]).toContain('outputFormat="application/json"');
  expect(posts[1]).not.toContain('outputFormat=');
  expect(result.total).toBeNull();
  const [city, polar] = result.features;
  const lonLat = toLonLat(city.getGeometry().getCoordinates());
  expect(lonLat[0]).toBeCloseTo(-58.25, 6);
  expect(lonLat[1]).toBeCloseTo(-34.5, 6);
  const polarCoordinates = polar.getGeometry().getCoordinates().flat(2);
  expect(polarCoordinates.every(Number.isFinite)).toBe(true);
  // The refusal is remembered: the next request goes straight to GML.
  await adapter.features(def, { limit: 10 });
  expect(posts).toHaveLength(3);
  expect(posts[2]).not.toContain('outputFormat=');
});

test('FES does not retry other server errors as GML', async () => {
  const fetch = vi.fn(async (url) =>
    String(url).includes('DescribeFeatureType')
      ? new Response(schema)
      : new Response(
          '<ows:ExceptionReport xmlns:ows="http://www.opengis.net/ows/1.1"><ows:Exception><ows:ExceptionText>Unknown feature type</ows:ExceptionText></ows:Exception></ows:ExceptionReport>',
        ),
  );
  vi.stubGlobal('fetch', fetch);
  const services = createServices({
    services: { main: { type: 'wfs', url: 'https://example.com/ows' } },
  });
  await expect(
    createFesAdapter(services, 'EPSG:3857').features(
      { id: 'places', source: { service: 'main', layers: 'demo:places' } },
      { limit: 1 },
    ),
  ).rejects.toThrow('Unknown feature type');
  expect(fetch.mock.calls.filter(([, o]) => o?.method === 'POST')).toHaveLength(
    1,
  );
});
