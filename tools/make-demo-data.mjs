import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const destination = fileURLToPath(
  new URL('../examples/configs/demo/static/data/', import.meta.url),
);
const sources = {
  cities: 'ne_110m_populated_places_simple',
  rivers: 'ne_110m_rivers_lake_centerlines',
  countries: 'ne_110m_admin_0_countries',
};

function options(args) {
  const result = {
    synthetic: false,
    ref: 'v5.1.2',
    outDir: destination,
    tolerance: 0.12,
  };
  for (let i = 0; i < args.length; i += 1) {
    const arg = args[i];
    if (arg === '--synthetic') result.synthetic = true;
    else if (arg === '--out-dir') result.outDir = path.resolve(args[++i] || '');
    else if (arg === '--ref') result.ref = args[++i];
    else if (arg === '--tolerance') result.tolerance = Number(args[++i]);
    else
      throw new Error(
        `Unknown argument: ${arg}. Use --synthetic, --out-dir, --ref, or --tolerance.`,
      );
  }
  if (
    !result.ref ||
    !Number.isFinite(result.tolerance) ||
    result.tolerance <= 0
  ) {
    throw new Error(
      'A source ref and a positive numeric simplification tolerance are required.',
    );
  }
  return result;
}

class UnavailableNetworkError extends Error {}

async function download(url) {
  let response;
  try {
    response = await fetch(url, { signal: AbortSignal.timeout(20000) });
  } catch (error) {
    throw new UnavailableNetworkError(`Download unavailable: ${error.message}`);
  }
  if (!response.ok)
    throw new Error(`Source returned HTTP ${response.status}: ${url}`);
  const collection = await response.json();
  if (
    collection.type !== 'FeatureCollection' ||
    !Array.isArray(collection.features)
  ) {
    throw new Error(`Source is not a GeoJSON FeatureCollection: ${url}`);
  }
  return collection;
}

function squaredDistance(point, start, end) {
  const dx = end[0] - start[0];
  const dy = end[1] - start[1];
  const t =
    dx || dy
      ? Math.max(
          0,
          Math.min(
            1,
            ((point[0] - start[0]) * dx + (point[1] - start[1]) * dy) /
              (dx * dx + dy * dy),
          ),
        )
      : 0;
  return (
    (point[0] - start[0] - t * dx) ** 2 + (point[1] - start[1] - t * dy) ** 2
  );
}

function simplifyLine(points, tolerance) {
  if (points.length < 3) return points;
  let furthest = -1;
  let distance = tolerance ** 2;
  for (let i = 1; i < points.length - 1; i += 1) {
    const candidate = squaredDistance(points[i], points[0], points.at(-1));
    if (candidate > distance) {
      distance = candidate;
      furthest = i;
    }
  }
  if (furthest < 0) return [points[0], points.at(-1)];
  return [
    ...simplifyLine(points.slice(0, furthest + 1), tolerance).slice(0, -1),
    ...simplifyLine(points.slice(furthest), tolerance),
  ];
}

function simplifyRing(points, tolerance) {
  if (points.length <= 8) return points;
  const vertices = points.slice(0, -1);
  let split = 1;
  for (let i = 2; i < vertices.length; i += 1) {
    if (
      squaredDistance(vertices[i], vertices[0], vertices[0]) >
      squaredDistance(vertices[split], vertices[0], vertices[0])
    )
      split = i;
  }
  const first = simplifyLine(vertices.slice(0, split + 1), tolerance);
  const second = simplifyLine(
    [...vertices.slice(split), vertices[0]],
    tolerance,
  );
  const ring = [...first.slice(0, -1), ...second];
  return ring.length >= 4 ? ring : points;
}

function rounded(value) {
  return typeof value[0] === 'number'
    ? value.map((number) => Math.round(number * 10000) / 10000)
    : value.map(rounded);
}

function simplifyGeometry(geometry, tolerance) {
  if (!geometry) return null;
  let coordinates = geometry.coordinates;
  if (geometry.type === 'Polygon')
    coordinates = coordinates.map((ring) => simplifyRing(ring, tolerance));
  if (geometry.type === 'MultiPolygon')
    coordinates = coordinates.map((polygon) =>
      polygon.map((ring) => simplifyRing(ring, tolerance)),
    );
  if (geometry.type === 'LineString')
    coordinates = simplifyLine(coordinates, tolerance / 4);
  if (geometry.type === 'MultiLineString')
    coordinates = coordinates.map((line) => simplifyLine(line, tolerance / 4));
  return { type: geometry.type, coordinates: rounded(coordinates) };
}

function property(properties, ...names) {
  for (const name of names) {
    const value =
      properties[name] ??
      properties[name.toUpperCase()] ??
      properties[name.toLowerCase()];
    if (value !== undefined && value !== null && value !== '') return value;
  }
  return null;
}

function neutralProperties(properties, kind, index) {
  const name = String(
    property(properties, 'name_en', 'name', 'admin') || `${kind} ${index + 1}`,
  );
  const result = { name };
  if (kind === 'cities') {
    result.country = String(
      property(properties, 'adm0name', 'sov0name', 'country') || 'Unknown',
    );
    result.population = Number(
      property(properties, 'pop_max', 'population') || 0,
    );
  }
  if (kind === 'countries') {
    result.country = name;
    result.population = Number(
      property(properties, 'pop_est', 'population') || 0,
    );
    result.continent = String(property(properties, 'continent') || 'Other');
    const tags = [
      result.continent,
      result.population >= 50000000 ? 'Large population' : 'Small population',
    ];
    result.tags = tags.join('; ');
    result.tags_filter = `|${tags.join('|')}|`;
  }
  return result;
}

function naturalEarthCollection(collection, kind, ref, tolerance) {
  return {
    type: 'FeatureCollection',
    name: `Demo ${kind}`,
    attribution: 'Made with Natural Earth. Public domain.',
    source: `https://github.com/nvkelso/natural-earth-vector/tree/${ref}/geojson`,
    sourceFile: `${sources[kind]}.geojson`,
    license:
      'Public domain: https://www.naturalearthdata.com/about/terms-of-use/',
    simplificationToleranceDegrees: tolerance,
    features: collection.features
      .filter((feature) => feature.geometry)
      .map((feature, index) => ({
        type: 'Feature',
        id: `${kind}-${index + 1}`,
        properties: neutralProperties(feature.properties || {}, kind, index),
        geometry: simplifyGeometry(feature.geometry, tolerance),
      })),
  };
}

function syntheticCollections() {
  const feature = (id, properties, type, coordinates) => ({
    type: 'Feature',
    id,
    properties,
    geometry: { type, coordinates },
  });
  const cityData = [
    ['London', 'United Kingdom', 8900000, -0.1276, 51.5072],
    ['Berlin', 'Germany', 3700000, 13.405, 52.52],
    ['Paris', 'France', 2100000, 2.3522, 48.8566],
    ['Rome', 'Italy', 2800000, 12.4964, 41.9028],
    ['Madrid', 'Spain', 3300000, -3.7038, 40.4168],
    ['Port Azure', 'Westland', 180000, -7, 34],
    ['Lake Azure', 'Eastland', 95000, 15, 31],
  ];
  const countries = [
    ['Westland', 'Europe', 12000000, -8, 35, 4, 47],
    ['Eastland', 'Asia', 68000000, 17, 25, 29, 37],
    ['Southland', 'Africa', 26000000, 2, 10, 16, 22],
  ].map(([name, continent, population, west, south, east, north], i) =>
    feature(
      `countries-${i + 1}`,
      neutralProperties({ name, continent, population }, 'countries', i),
      'Polygon',
      [
        [
          [west, south],
          [east, south],
          [east, north],
          [west, north],
          [west, south],
        ],
      ],
    ),
  );
  const datasets = {
    cities: cityData.map(([name, country, population, lon, lat], i) =>
      feature(`cities-${i + 1}`, { name, country, population }, 'Point', [
        lon,
        lat,
      ]),
    ),
    rivers: [
      feature('rivers-1', { name: 'Azure River' }, 'LineString', [
        [-6, 44],
        [-2, 42],
        [1, 38],
      ]),
      feature('rivers-2', { name: 'Green River' }, 'LineString', [
        [19, 34],
        [24, 31],
        [26, 27],
      ]),
    ],
    countries,
  };
  return Object.fromEntries(
    Object.entries(datasets).map(([name, features]) => [
      name,
      {
        type: 'FeatureCollection',
        name: `Synthetic demo ${name}`,
        attribution: 'Synthetic demonstration data by webgis-kit contributors.',
        source:
          'Deterministic --synthetic generator; coordinates are illustrative.',
        license: 'CC0-1.0',
        synthetic: true,
        features,
      },
    ]),
  );
}

async function main() {
  const opts = options(process.argv.slice(2));
  let datasets;
  if (opts.synthetic) datasets = syntheticCollections();
  else {
    try {
      const raw = Object.fromEntries(
        await Promise.all(
          Object.entries(sources).map(async ([kind, name]) => [
            kind,
            await download(
              `https://raw.githubusercontent.com/nvkelso/natural-earth-vector/${opts.ref}/geojson/${name}.geojson`,
            ),
          ]),
        ),
      );
      datasets = Object.fromEntries(
        Object.entries(raw).map(([kind, data]) => [
          kind,
          naturalEarthCollection(data, kind, opts.ref, opts.tolerance),
        ]),
      );
      let tolerance = opts.tolerance;
      while (
        Buffer.byteLength(JSON.stringify(datasets.countries)) > 300000 &&
        tolerance < 2
      ) {
        tolerance *= 1.5;
        datasets.countries = naturalEarthCollection(
          raw.countries,
          'countries',
          opts.ref,
          tolerance,
        );
      }
      if (Buffer.byteLength(JSON.stringify(datasets.countries)) > 300000) {
        throw new Error(
          'Country dataset exceeds 300 KB; increase --tolerance explicitly.',
        );
      }
    } catch (error) {
      if (!(error instanceof UnavailableNetworkError)) throw error;
      console.warn(
        `${error.message}. Generated synthetic demonstration data instead.`,
      );
      datasets = syntheticCollections();
    }
  }
  await fs.mkdir(opts.outDir, { recursive: true });
  for (const [kind, collection] of Object.entries(datasets)) {
    const output = `${JSON.stringify(collection)}\n`;
    const file = path.join(opts.outDir, `${kind}.geojson`);
    await fs.writeFile(file, output, 'utf8');
    console.log(
      `${kind}: ${collection.features.length} features, ${Buffer.byteLength(output)} bytes, ${collection.synthetic ? 'synthetic' : 'Natural Earth'} â†’ ${file}`,
    );
  }
}

main().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});
