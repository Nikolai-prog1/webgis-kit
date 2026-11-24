import WFS from 'ol/format/WFS.js';
import {
  projectGeographicFeatures,
  readWfsGeoJSON,
  WFS_CRS,
} from '../wfsGeoJSON.js';
import * as filter from 'ol/format/filter.js';
import { request, ogcException } from '../http.js';
export function toFes(where) {
  if (!where) return undefined;
  for (const key of ['and', 'or'])
    if (where[key]) {
      const parts = where[key].map(toFes).filter(Boolean);
      return !parts.length
        ? undefined
        : parts.length === 1
          ? parts[0]
          : filter[key](...parts);
    }
  const { field, op, value } = where;
  if (op === 'isNull' || (op === 'eq' && value === null))
    return filter.isNull(field);
  if (op === 'neq' && value === null) return filter.not(filter.isNull(field));
  if (op === 'in')
    return value.length
      ? toFes({ or: value.map((value) => ({ field, op: 'eq', value })) })
      : filter.and(filter.isNull(field), filter.not(filter.isNull(field)));
  if (op === 'like' || op === 'ilike')
    return filter.like(field, String(value), '%', '_', '\\', op !== 'ilike');
  const fn = {
    eq: 'equalTo',
    neq: 'notEqualTo',
    lt: 'lessThan',
    lte: 'lessThanOrEqualTo',
    gt: 'greaterThan',
    gte: 'greaterThanOrEqualTo',
  }[op];
  if (!fn) throw new Error(`Unsupported condition: ${op}`);
  if (
    ['lt', 'lte', 'gt', 'gte'].includes(op) &&
    !Number.isFinite(Number(value))
  )
    return undefined;
  return filter[fn](
    field,
    ['lt', 'lte', 'gt', 'gte'].includes(op) ? Number(value) : value,
  );
}
// Servers that rejected GeoJSON output; their GetFeature requests use the
// server's default GML instead (MapServer allows only GML unless configured).
const OUTPUT_FORMAT_ERROR = /output ?format/i;
export function createFesAdapter(services, projection) {
  const cache = new Map();
  const gmlOnly = new Set();
  // WFS 2.0 by default; services that speak only 1.x (QGIS Server: 1.0/1.1)
  // set wfsVersion, which selects the request encoding and filter namespace.
  const formats = new Map();
  const versionOf = (id) => services.get(id).wfsVersion || '2.0.0';
  const formatOf = (version) => {
    if (!formats.has(version)) formats.set(version, new WFS({ version }));
    return formats.get(version);
  };
  const serviceId = (def) => def.query?.service || def.source.service;
  const name = (def) =>
    services.qualified(
      serviceId(def),
      def.query?.typeName || def.source.typeName || def.source.layers,
    );
  async function describe(def) {
    const key = `${serviceId(def)}:${name(def)}`;
    if (!cache.has(key))
      cache.set(
        key,
        (async () => {
          const url = new URL(services.wfsUrl(serviceId(def)));
          const version = versionOf(serviceId(def));
          url.search = new URLSearchParams({
            service: 'WFS',
            version,
            request: 'DescribeFeatureType',
            [version.startsWith('2') ? 'typeNames' : 'typeName']: name(def),
          }).toString();
          const xml = new DOMParser().parseFromString(
            await (await request(url)).text(),
            'text/xml',
          );
          const exception = ogcException(
            new XMLSerializer().serializeToString(xml),
          );
          if (exception) throw new Error(exception);
          const elements = [
            ...xml.getElementsByTagNameNS('*', 'element'),
          ].filter(
            (node) => node.getAttribute('name') && node.getAttribute('type'),
          );
          const geometry = elements.find((node) =>
            /gml:.*(?:PropertyType|Geometry)/.test(node.getAttribute('type')),
          );
          return {
            namespace: xml.documentElement.getAttribute('targetNamespace'),
            geometryName: geometry?.getAttribute('name') || 'geometry',
            fields: elements
              .filter(
                (node) =>
                  node !== geometry &&
                  /(?:string|int|double|decimal|float|long|bool|date|time)/i.test(
                    node.getAttribute('type'),
                  ),
              )
              .map((node) => ({
                name: node.getAttribute('name'),
                type: /int|double|decimal|float|long/i.test(
                  node.getAttribute('type'),
                )
                  ? 'number'
                  : /bool/i.test(node.getAttribute('type'))
                    ? 'boolean'
                    : /date|time/i.test(node.getAttribute('type'))
                      ? 'date'
                      : 'string',
              })),
          };
        })().catch((error) => {
          cache.delete(key);
          throw error;
        }),
      );
    return cache.get(key);
  }
  async function features(def, options = {}) {
    const service = services.get(serviceId(def));
    const description = await describe(def);
    const qualified = name(def);
    const parts = qualified.split(':');
    const requested =
      options.properties ||
      (options.withGeometry === false
        ? description.fields.map((field) => field.name)
        : undefined);
    const properties = requested
      ? [
          ...requested,
          ...(options.withGeometry === false ? [] : [description.geometryName]),
        ]
      : undefined;
    const id = serviceId(def);
    const version = versionOf(id);
    const legacy = !version.startsWith('2');
    const format = formatOf(version);
    const body = (json) => {
      const node = format.writeGetFeature({
        featureNS: service.featureNS || description.namespace,
        featurePrefix: parts.length > 1 ? parts[0] : undefined,
        featureTypes: [parts.at(-1)],
        srsName: WFS_CRS,
        ...(json ? { outputFormat: 'application/json' } : {}),
        ...(legacy ? { maxFeatures: options.limit } : { count: options.limit }),
        startIndex: options.offset,
        propertyNames: properties,
        filter: toFes(options.where),
      });
      appendSortBy(node);
      return new XMLSerializer().serializeToString(node);
    };
    function appendSortBy(node) {
      if (!options.sortBy?.length) return;
      const [namespace, prefix, reference] = legacy
        ? ['http://www.opengis.net/ogc', 'ogc', 'PropertyName']
        : ['http://www.opengis.net/fes/2.0', 'fes', 'ValueReference'];
      const sortBy = document.createElementNS(namespace, `${prefix}:SortBy`);
      for (const sort of options.sortBy) {
        const property = document.createElementNS(
          namespace,
          `${prefix}:SortProperty`,
        );
        const field = document.createElementNS(
          namespace,
          `${prefix}:${reference}`,
        );
        field.textContent = sort.field;
        const order = document.createElementNS(
          namespace,
          `${prefix}:SortOrder`,
        );
        order.textContent = sort.dir === 'desc' ? 'DESC' : 'ASC';
        property.append(field, order);
        sortBy.append(property);
      }
      node.firstChild.appendChild(sortBy);
    }
    const post = async (json) => {
      const text = await (
        await request(services.wfsUrl(id), {
          method: 'POST',
          headers: { 'Content-Type': 'application/xml' },
          body: body(json),
          signal: options.signal,
        })
      ).text();
      const exception = ogcException(text);
      if (exception) throw new Error(exception);
      return text;
    };
    let text;
    if (gmlOnly.has(id)) text = await post(false);
    else
      try {
        text = await post(true);
      } catch (error) {
        if (!OUTPUT_FORMAT_ERROR.test(String(error?.message))) throw error;
        gmlOnly.add(id);
        text = await post(false);
      }
    if (/^\s*\{/.test(text)) {
      const data = JSON.parse(text);
      const total = Number(data.numberMatched ?? data.totalFeatures);
      const features = readWfsGeoJSON(data, projection);
      if (options.withGeometry === false)
        features.forEach((feature) => feature.setGeometry(undefined));
      return { features, total: Number.isFinite(total) ? total : null };
    }
    const xml = new DOMParser().parseFromString(text, 'text/xml');
    const raw =
      xml.documentElement.getAttribute('numberMatched') ||
      xml.documentElement.getAttribute('numberOfFeatures');
    const total =
      raw !== null && raw !== '' && Number.isFinite(Number(raw))
        ? Number(raw)
        : null;
    // Read in geographic coordinates (GML srsName decides the axis order),
    // then clip polar latitudes before projecting, as for GeoJSON.
    const features = projectGeographicFeatures(
      formatOf(version).readFeatures(xml, {
        dataProjection: WFS_CRS,
        featureProjection: WFS_CRS,
      }),
      projection,
    );
    if (options.withGeometry === false)
      features.forEach((feature) => feature.setGeometry(undefined));
    return { features, total };
  }
  return { describe, features };
}
