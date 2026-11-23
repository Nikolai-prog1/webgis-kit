import { request, ogcException } from './http.js';
const children = (node, name) =>
  Array.from(node?.childNodes || []).filter(
    (node) => node.nodeType === 1 && (!name || node.localName === name),
  );
const child = (node, name) => children(node, name)[0];
const text = (node, name) => child(node, name)?.textContent?.trim() || '';
const value = (node, name) => {
  const raw = node?.getAttribute(name);
  return raw !== null &&
    raw !== undefined &&
    raw !== '' &&
    Number.isFinite(Number(raw))
    ? Number(raw)
    : null;
};
export function parseCapabilities(xmlText, parser = new DOMParser()) {
  const exception =
    typeof DOMParser !== 'undefined' ? ogcException(xmlText) : null;
  if (exception) throw new Error(exception);
  const xml = parser.parseFromString(xmlText, 'text/xml');
  const root = xml.documentElement;
  if (!['WMT_MS_Capabilities', 'WMS_Capabilities'].includes(root.localName))
    throw new Error('Expected WMS GetCapabilities XML');
  const version = root.getAttribute('version');
  function layer(node, parent = {}) {
    const geo = child(node, 'EX_GeographicBoundingBox'),
      latlon = child(node, 'LatLonBoundingBox');
    let extent = parent.extent || null;
    if (geo)
      extent = [
        'westBoundLongitude',
        'southBoundLatitude',
        'eastBoundLongitude',
        'northBoundLatitude',
      ].map((key) => Number(text(geo, key)));
    else if (latlon)
      extent = ['minx', 'miny', 'maxx', 'maxy'].map((key) =>
        value(latlon, key),
      );
    else {
      const box = children(node, 'BoundingBox').find((box) =>
        ['EPSG:4326', 'CRS:84'].includes(
          box.getAttribute('CRS') || box.getAttribute('SRS'),
        ),
      );
      if (box) {
        const xy = ['minx', 'miny', 'maxx', 'maxy'].map((key) =>
          value(box, key),
        );
        extent =
          version === '1.3.0' && box.getAttribute('CRS') === 'EPSG:4326'
            ? [xy[1], xy[0], xy[3], xy[2]]
            : xy;
      }
    }
    const hint = child(node, 'ScaleHint');
    const conversion = 1 / ((0.0254 / 72) * Math.SQRT2);
    const minScale = text(node, 'MinScaleDenominator')
      ? Number(text(node, 'MinScaleDenominator'))
      : value(hint, 'min') !== null
        ? value(hint, 'min') * conversion
        : (parent.minScale ?? null);
    const maxScale = text(node, 'MaxScaleDenominator')
      ? Number(text(node, 'MaxScaleDenominator'))
      : value(hint, 'max') !== null
        ? value(hint, 'max') * conversion
        : (parent.maxScale ?? null);
    const style = child(node, 'Style');
    const legend = child(child(style, 'LegendURL'), 'OnlineResource');
    const result = {
      name: text(node, 'Name'),
      title: text(node, 'Title'),
      abstract: text(node, 'Abstract'),
      queryable: node.hasAttribute('queryable')
        ? node.getAttribute('queryable') === '1' ||
          node.getAttribute('queryable') === 'true'
        : (parent.queryable ?? false),
      extent,
      minScale,
      maxScale,
      legendUrl:
        legend?.getAttributeNS('http://www.w3.org/1999/xlink', 'href') ||
        legend?.getAttribute('xlink:href') ||
        null,
      crs: [
        ...new Set([
          ...(parent.crs || []),
          ...children(node)
            .filter((node) => ['CRS', 'SRS'].includes(node.localName))
            .flatMap((node) => node.textContent.trim().split(/\s+/)),
        ]),
      ],
      children: [],
    };
    result.children = children(node, 'Layer').map((node) =>
      layer(node, result),
    );
    return result;
  }
  const capability = child(root, 'Capability');
  const top = child(capability, 'Layer');
  if (!top) throw new Error('Capabilities has no layer tree');
  return {
    version,
    title: text(child(root, 'Service'), 'Title'),
    layer: layer(top),
  };
}
export function wildcard(pattern, value) {
  return new RegExp(
    '^' +
      pattern
        .split('*')
        .map((part) => part.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))
        .join('.*') +
      '$',
  ).test(value);
}
function stableId(value) {
  let hash = 0;
  for (const char of value)
    hash = ((hash << 5) - hash + char.charCodeAt(0)) | 0;
  return `${
    value
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '') || 'layer'
  }-${(hash >>> 0).toString(36)}`;
}
export function capabilitiesToCatalog(tree, options) {
  const allowed = (name) =>
    (options.include || ['*']).some((pattern) => wildcard(pattern, name)) &&
    !(options.exclude || []).some((pattern) => wildcard(pattern, name));
  function flatten(layer) {
    return [...(layer.name ? [layer] : []), ...layer.children.flatMap(flatten)];
  }
  const leaves = tree.layer.children.filter((layer) => !layer.children.length);
  const parents = tree.layer.children.filter((layer) => layer.children.length);
  const roots = tree.layer.children.length
    ? [
        ...(leaves.length
          ? [
              {
                ...tree.layer,
                name: '',
                catalogGroupId: options.id,
                title: tree.layer.title || options.title || tree.title,
                children: leaves,
              },
            ]
          : []),
        ...parents,
      ]
    : [tree.layer];
  return {
    $schema: '../../../../src/core/config/schema/catalog.schema.json',
    groups: roots
      .map((group) => ({
        id: stableId(group.catalogGroupId || group.name || group.title),
        title: group.title || tree.title || 'WMS',
        layers: flatten(group)
          .filter((layer) => allowed(layer.name))
          .map((layer) => ({
            id: `${options.id}-${stableId(layer.name)}`,
            title: options.titles?.[layer.name] || layer.title || layer.name,
            geometry: 'raster',
            source: {
              type: 'wms',
              service: options.service,
              layers: layer.name,
              tiled: true,
            },
            queryable: layer.queryable,
            table: false,
            visible: false,
            extent: layer.extent,
            minScale: layer.minScale,
            maxScale: layer.maxScale,
            note: layer.abstract,
            ...(layer.legendUrl
              ? {
                  legend: [
                    { type: 'image', url: layer.legendUrl, label: layer.title },
                  ],
                }
              : {}),
          })),
      }))
      .filter((group) => group.layers.length),
  };
}
export async function loadCapabilities(url, options = {}) {
  const target = new URL(url);
  target.searchParams.set('SERVICE', 'WMS');
  target.searchParams.set('REQUEST', 'GetCapabilities');
  target.searchParams.set('VERSION', options.version || '1.3.0');
  const key = `webgis:wms:${target.href}`;
  let storage;
  try {
    storage =
      options.storage === null ? null : options.storage || sessionStorage;
    const cached = storage?.getItem(key);
    if (cached) return JSON.parse(cached);
  } catch {
    /* Session cache is optional. */
  }
  const tree = parseCapabilities(
    await (await request(target, { signal: options.signal })).text(),
  );
  try {
    storage?.setItem(key, JSON.stringify(tree));
  } catch {
    /* Quota or policy may deny caching. */
  }
  return tree;
}
