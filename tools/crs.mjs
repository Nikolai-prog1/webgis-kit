#!/usr/bin/env node
// Adds a coordinate reference system to an instance: coordinate display, the
// go-to/marker tools and, with --map, the map's own projection.
//
//   npm run crs -- add EPSG:7801 [--label "BGS2005"] [--map] [--no-status]
//   npm run crs -- add path/to/data.prj --code LOCAL:K9 --label "1970 K-9" [--area W,S,E,N]
//   npm run crs -- add "+proj=..." --code LOCAL:1 --area 22.3,41.2,28.7,44.3
//   npm run crs -- list
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import proj4 from 'proj4';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

// Common systems, so the usual cases work offline and without GDAL.
// Definitions and areas of use are taken from the EPSG database (PROJ 9).
const KNOWN = {
  'EPSG:7801': {
    label: 'BGS2005 / CCS2005',
    proj4:
      '+proj=lcc +lat_0=42.6678756833333 +lon_0=25.5 +lat_1=42 +lat_2=43.3333333333333 +x_0=500000 +y_0=4725824.3591 +ellps=GRS80 +towgs84=0,0,0,0,0,0,0 +units=m +no_defs',
    area: [22.36, 41.24, 28.68, 44.23],
  },
  'EPSG:3035': {
    label: 'ETRS89 / LAEA Europe',
    proj4:
      '+proj=laea +lat_0=52 +lon_0=10 +x_0=4321000 +y_0=3210000 +ellps=GRS80 +units=m +no_defs',
    area: [-35.58, 24.6, 44.83, 84.73],
  },
  'EPSG:31700': {
    label: 'Stereo 70',
    proj4:
      '+proj=sterea +lat_0=46 +lon_0=25 +k=0.99975 +x_0=500000 +y_0=500000 +ellps=krass +units=m +no_defs',
    area: [20.26, 43.44, 31.41, 48.27],
  },
  'EPSG:2100': {
    label: 'GGRS87 / Greek Grid',
    proj4:
      '+proj=tmerc +lat_0=0 +lon_0=24 +k=0.9996 +x_0=500000 +y_0=0 +ellps=GRS80 +towgs84=-199.87,74.79,246.62,0,0,0,0 +units=m +no_defs',
    area: [19.57, 34.88, 28.3, 41.75],
  },
  'EPSG:2180': {
    label: 'ETRF2000-PL / CS92',
    proj4:
      '+proj=tmerc +lat_0=0 +lon_0=19 +k=0.9993 +x_0=500000 +y_0=-5300000 +ellps=GRS80 +towgs84=0,0,0,0,0,0,0 +units=m +no_defs',
    area: [14.14, 49, 24.15, 55.93],
  },
  'EPSG:4258': {
    label: 'ETRS89',
    proj4: '+proj=longlat +ellps=GRS80 +towgs84=0,0,0,0,0,0,0 +no_defs',
    area: [-16.1, 32.88, 40.18, 84.73],
  },
};

// UTM zones are regular, so they are generated rather than listed.
function utm(code) {
  const match = /^EPSG:(326|327|258)(\d\d)$/.exec(code);
  if (!match) return null;
  const zone = Number(match[2]);
  if (zone < 1 || zone > 60 || (match[1] === '258' && (zone < 28 || zone > 38)))
    return null;
  const west = -180 + (zone - 1) * 6;
  const south = match[1] === '327';
  const datum =
    match[1] === '258' ? '+ellps=GRS80 +towgs84=0,0,0,0,0,0,0' : '+datum=WGS84';
  return {
    label: `${match[1] === '258' ? 'ETRS89' : 'WGS 84'} / UTM zone ${zone}${south ? 'S' : 'N'}`,
    proj4: `+proj=utm +zone=${zone}${south ? ' +south' : ''} ${datum} +units=m +no_defs`,
    area: [
      west,
      south ? -80 : match[1] === '258' ? 34 : 0,
      west + 6,
      south ? 0 : 84,
    ],
  };
}

function gdalsrsinfo() {
  if (process.env.WEBGIS_GDALSRSINFO) return process.env.WEBGIS_GDALSRSINFO;
  const probe = spawnSync('gdalsrsinfo', ['--version'], { encoding: 'utf8' });
  if (probe.status === 0) return 'gdalsrsinfo';
  if (process.platform === 'win32') {
    const base = process.env.ProgramFiles || 'C:/Program Files';
    if (fs.existsSync(base))
      for (const dir of fs
        .readdirSync(base)
        .filter((name) => /^QGIS /.test(name))
        .sort()
        .reverse()) {
        const exe = path.join(base, dir, 'bin', 'gdalsrsinfo.exe');
        if (fs.existsSync(exe)) return exe;
      }
  }
  return null;
}

function fromGdal(input) {
  const tool = gdalsrsinfo();
  if (!tool) return null;
  const run = (format) =>
    spawnSync(tool, ['-o', format, input], { encoding: 'utf8' });
  const proj = run('proj4');
  if (proj.status !== 0 || !proj.stdout.trim()) return null;
  const result = { proj4: proj.stdout.trim().replace(/^'|'$/g, '') };
  const json = run('projjson');
  try {
    const parsed = JSON.parse(json.stdout);
    if (parsed.name) result.label = parsed.name;
    const box = parsed.bbox;
    if (box)
      result.area = [
        box.west_longitude,
        box.south_latitude,
        box.east_longitude,
        box.north_latitude,
      ];
  } catch {
    // proj4 alone is enough when the system has no recorded area of use
  }
  return result;
}

async function fromEpsgIo(code) {
  const number = /^EPSG:(\d+)$/.exec(code)?.[1];
  if (!number) return null;
  try {
    const proj = await fetch(`https://epsg.io/${number}.proj4`);
    if (!proj.ok) return null;
    const result = { proj4: (await proj.text()).trim() };
    const meta = await fetch(`https://epsg.io/${number}.json`);
    if (meta.ok) {
      const data = await meta.json();
      if (data.name) result.label = data.name;
      if (data.bbox)
        result.area = [
          data.bbox.west_longitude,
          data.bbox.south_latitude,
          data.bbox.east_longitude,
          data.bbox.north_latitude,
        ];
    }
    return result;
  } catch {
    return null;
  }
}

// Projected bounds of an area of use: sample its edges and interior densely,
// because projected outlines of a lon/lat box are curved.
export function projectedBbox(proj, area) {
  const [west, south, east, north] = area;
  const xs = [];
  const ys = [];
  for (let i = 0; i <= 20; i++)
    for (let j = 0; j <= 20; j++) {
      const lon = west + ((east - west) * i) / 20;
      const lat = south + ((north - south) * j) / 20;
      const [x, y] = proj4('EPSG:4326', proj, [lon, lat]);
      if (Number.isFinite(x) && Number.isFinite(y)) {
        xs.push(x);
        ys.push(y);
      }
    }
  if (!xs.length) throw new Error('The area of use cannot be projected.');
  const round = (value) => Math.round(value);
  return [
    round(Math.min(...xs)),
    round(Math.min(...ys)),
    round(Math.max(...xs)),
    round(Math.max(...ys)),
  ];
}

export async function resolveCrs(input, options = {}) {
  const value = input.trim();
  const epsg = /^(?:EPSG:)?(\d+)$/i.exec(value);
  const code = options.code || (epsg ? `EPSG:${epsg[1]}` : null);
  if (!code)
    throw new Error(
      'A system without an EPSG code needs --code, for example --code LOCAL:K9.',
    );
  let found =
    (epsg && (KNOWN[code] || utm(code))) ||
    fromGdal(epsg ? code : value) ||
    (epsg ? await fromEpsgIo(code) : null);
  if (!found && /^\+proj=/.test(value)) found = { proj4: value };
  if (!found)
    throw new Error(
      `Cannot resolve ${value}. Install GDAL (QGIS includes it), allow https://epsg.io, or pass the PROJ string directly ("+proj=...").`,
    );
  const area = options.area || found.area;
  if (!area)
    throw new Error(
      `${code} has no recorded area of use: add --area west,south,east,north in degrees (where the system is valid, e.g. the country or zone).`,
    );
  const geographic = /\+proj=longlat/.test(found.proj4);
  const item = {
    code,
    label: options.label || found.label || code,
    kind: geographic ? 'geographic' : 'projected',
    decimals: geographic ? 6 : 2,
    proj4: found.proj4,
  };
  if (area) {
    proj4.defs(code, found.proj4);
    item.worldBbox = area;
    item.bbox = geographic ? area : projectedBbox(code, area);
  }
  return item;
}

function parseArgs(args) {
  const options = { status: true };
  const rest = [];
  for (let i = 0; i < args.length; i++) {
    const value = args[i];
    const next = () => {
      if (args[i + 1] === undefined)
        throw new Error(`Missing value for ${value}.`);
      return args[++i];
    };
    if (value === '--code') options.code = next();
    else if (value === '--label') options.label = next();
    else if (value === '--instance') options.instance = next();
    else if (value === '--area') {
      options.area = next().split(',').map(Number);
      if (options.area.length !== 4 || !options.area.every(Number.isFinite))
        throw new Error('--area expects west,south,east,north in degrees.');
    } else if (value === '--map') options.map = true;
    else if (value === '--no-status') options.status = false;
    else rest.push(value);
  }
  return { command: rest[0], input: rest[1], options };
}

async function main() {
  const { command, input, options } = parseArgs(process.argv.slice(2));
  const instance = path.resolve(
    options.instance || process.env.WEBGIS_APP_DIR || path.join(root, 'app'),
  );
  const file = path.join(instance, 'static/config/app.json');
  const config = JSON.parse(fs.readFileSync(file, 'utf8'));
  config.crs ||= [];
  if (command === 'list') {
    for (const item of config.crs)
      console.log(
        `${item.code}\t${item.label}${config.map.projection === item.code ? '\t(map)' : ''}`,
      );
    return;
  }
  if (command !== 'add' || !input)
    throw new Error(
      'Usage: npm run crs -- add <EPSG:code | file.prj | "+proj=..."> [--code ID] [--label TEXT] [--area W,S,E,N] [--map] [--no-status]\n       npm run crs -- list',
    );
  const item = await resolveCrs(input, options);
  if (options.map && item.kind === 'projected' && !item.bbox)
    throw new Error(
      'Using this system as the map projection needs its area: add --area west,south,east,north (degrees).',
    );
  const index = config.crs.findIndex((entry) => entry.code === item.code);
  if (index >= 0) config.crs[index] = { ...config.crs[index], ...item };
  else config.crs.push(item);
  if (options.status) {
    config.statusBar ||= {};
    config.statusBar.coordinates ||= [];
    if (!config.statusBar.coordinates.includes(item.code))
      config.statusBar.coordinates.push(item.code);
  }
  if (options.map) config.map.projection = item.code;
  const previous = fs.readFileSync(file);
  fs.writeFileSync(file, JSON.stringify(config, null, 2) + '\n');
  const check = spawnSync(
    process.execPath,
    [path.join(root, 'tools/validate-config.mjs'), instance],
    { encoding: 'utf8' },
  );
  if (check.status !== 0) {
    fs.writeFileSync(file, previous);
    throw new Error(
      `Configuration rejected; nothing changed.\n${check.stdout}${check.stderr}`,
    );
  }
  console.log(
    `Added ${item.code} (${item.label}) to coordinate display and go-to${options.map ? '; the map now uses this projection' : ''}.`,
  );
}

if (
  process.argv[1] &&
  path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)
)
  main().catch((error) => {
    console.error(`crs: ${error.message}`);
    process.exitCode = 1;
  });
