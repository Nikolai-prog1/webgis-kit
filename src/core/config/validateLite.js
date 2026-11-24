import { allLayerDefs } from './normalize.js';
export function validateLite(config) {
  const errors = [];
  const error = (path, message) => errors.push(`${path}: ${message}`);
  if (config.version !== 1) error('version', 'expected 1');
  if (!config.app?.id || !/^[a-z0-9][a-z0-9-]*$/.test(config.app.id))
    error('app.id', 'expected a lowercase identifier');
  if (
    !Array.isArray(config.map?.center) ||
    config.map.center.length !== 2 ||
    !config.map.center.every(Number.isFinite)
  )
    error('map.center', 'expected [longitude, latitude]');
  if (!Number.isFinite(config.map?.zoom))
    error('map.zoom', 'expected a number');
  if (
    config.map?.center &&
    (Math.abs(config.map.center[0]) > 180 ||
      Math.abs(config.map.center[1]) > 90)
  )
    error('map.center', 'coordinates must be longitude/latitude');
  function checkExtent(extent, path) {
    if (
      extent &&
      (!extent.every(Number.isFinite) ||
        extent.length !== 4 ||
        extent[0] > extent[2] ||
        extent[1] > extent[3])
    )
      error(path, 'expected ordered finite bounds');
  }
  for (const key of ['extent', 'homeExtent'])
    checkExtent(config.map[key], `map.${key}`);
  for (const item of config.crs) {
    checkExtent(item.bbox, `crs.${item.code}.bbox`);
    checkExtent(item.worldBbox, `crs.${item.code}.worldBbox`);
    if (!['EPSG:4326', 'EPSG:3857'].includes(item.code) && !item.proj4)
      error(`crs.${item.code}.proj4`, 'required for a custom CRS');
  }
  const projection = config.map?.projection;
  if (projection && !['EPSG:4326', 'EPSG:3857'].includes(projection)) {
    const item = config.crs.find((entry) => entry.code === projection);
    if (!item) error('map.projection', 'add this CRS to crs[] first');
    else if (!item.bbox)
      error(
        `crs.${projection}.bbox`,
        'required when the map uses this projection (its valid area, in its own units)',
      );
  }
  function checkUrl(value, path) {
    try {
      if (
        !['http:', 'https:'].includes(
          new URL(value, 'https://example.com/').protocol,
        )
      )
        throw new Error();
    } catch {
      error(path, 'expected a relative URL or HTTP(S) URL');
    }
  }
  for (const [id, item] of Object.entries(config.services))
    checkUrl(item.url, `services.${id}.url`);
  const unique = (items, key, path) => {
    const seen = new Set();
    for (const item of items) {
      if (seen.has(item[key])) error(path, `duplicate ${key}: ${item[key]}`);
      seen.add(item[key]);
    }
  };
  unique(config.catalogs, 'id', 'catalogs');
  unique(config.sidebar, 'id', 'sidebar');
  unique(config.crs, 'code', 'crs');
  unique(config.basemaps.items, 'id', 'basemaps.items');
  const defs = allLayerDefs(config);
  unique(defs, 'id', 'layers');
  const ids = new Set(defs.map((def) => def.id));
  const crs = new Set(config.crs.map((item) => item.code));
  const service = (id, path) => {
    if (!config.services[id]) error(path, `unknown service: ${id}`);
  };
  for (const [id, item] of Object.entries(config.services))
    if (
      item.projection &&
      !crs.has(item.projection) &&
      !['EPSG:4326', 'EPSG:3857'].includes(item.projection)
    )
      error(`services.${id}.projection`, 'unknown CRS');
  for (const item of config.basemaps.items) {
    if (item.type === 'wms') {
      service(item.service, `basemaps.${item.id}.service`);
      if (!item.layers) error(`basemaps.${item.id}.layers`, 'required for WMS');
    }
    if (item.type === 'xyz') {
      if (!item.url) error(`basemaps.${item.id}.url`, 'required for XYZ');
      else checkUrl(item.url, `basemaps.${item.id}.url`);
    }
  }
  for (const def of defs) {
    if (!def.id || !def.source) {
      error('layers', 'id and source are required');
      continue;
    }
    checkExtent(def.extent, `layers.${def.id}.extent`);
    for (const field of def.source.type === 'wms'
      ? ['service', 'layers']
      : def.source.type === 'wfs'
        ? ['service', 'typeName']
        : ['url'])
      if (!def.source[field])
        error(
          `layers.${def.id}.source.${field}`,
          'required for this source type',
        );
    if (def.source.url) checkUrl(def.source.url, `layers.${def.id}.source.url`);
    if (['wms', 'wfs'].includes(def.source.type))
      service(def.source.service, `layers.${def.id}.source.service`);
    if (def.query?.service)
      service(def.query.service, `layers.${def.id}.query.service`);
    if (
      def.source.projection &&
      !crs.has(def.source.projection) &&
      !['EPSG:4326', 'EPSG:3857'].includes(def.source.projection)
    )
      error(`layers.${def.id}.source.projection`, 'unknown CRS');
    for (const pattern of def.source.emptyOnException || []) {
      try {
        new RegExp(pattern);
      } catch {
        error(
          `layers.${def.id}.source.emptyOnException`,
          'invalid regular expression',
        );
      }
    }
  }
  for (const cat of config.catalogs) {
    if (cat.type === 'wms-capabilities')
      service(cat.service, `catalogs.${cat.id}.service`);
    unique(cat.groups, 'id', `catalogs.${cat.id}.groups`);
    for (const group of cat.groups)
      if (
        group.exclusive &&
        group.layers.filter((def) => def.visible).length > 1
      )
        error(
          `catalogs.${cat.id}.${group.id}`,
          'multiple visible layers in exclusive group',
        );
  }
  for (const section of config.sidebar)
    for (const block of section.blocks || []) {
      for (const id of [
        ...(block.layers || []),
        ...(block.layer ? [block.layer] : []),
      ])
        if (!ids.has(id))
          error(`sidebar.${section.id}`, `unknown layer: ${id}`);
      if (
        block.catalog &&
        !config.catalogs.some((cat) => cat.id === block.catalog)
      )
        error(`sidebar.${section.id}`, `unknown catalog: ${block.catalog}`);
    }
  for (const code of config.statusBar.coordinates)
    if (!crs.has(code)) error('statusBar.coordinates', `unknown CRS: ${code}`);
  for (const item of config.crs)
    if (
      item.kind === 'projected' &&
      config.toolbar.includes('goto-coordinates') &&
      !item.bbox
    )
      error(`crs.${item.code}.bbox`, 'required for coordinate input');
  if (config.basemaps.default === 'none') {
    if (!config.basemaps.allowNone)
      error('basemaps.default', 'none requires allowNone');
  } else if (
    !config.basemaps.items.some((item) => item.id === config.basemaps.default)
  )
    error('basemaps.default', 'unknown base map');
  if (!config.app.locales.includes(config.app.locale))
    error('app.locale', 'must be listed in app.locales');
  return errors;
}
