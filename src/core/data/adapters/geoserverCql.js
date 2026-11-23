import { readWfsGeoJSON, WFS_CRS } from '../wfsGeoJSON.js';
import { toCql, fieldName } from '../cql.js';
import { requestJSON } from '../http.js';
export function createGeoServerAdapter(services, projection) {
  const cache = new Map();
  const serviceId = (def) => def.query?.service || def.source.service;
  const typeName = (def) =>
    services.qualified(
      serviceId(def),
      def.query?.typeName || def.source.typeName || def.source.layers,
    );
  function url(def, request) {
    const url = new URL(services.wfsUrl(serviceId(def)));
    url.searchParams.set('service', 'WFS');
    url.searchParams.set(
      'version',
      services.get(serviceId(def)).wfsVersion || '2.0.0',
    );
    url.searchParams.set('request', request);
    url.searchParams.set('typeNames', typeName(def));
    url.searchParams.set('outputFormat', 'application/json');
    return url;
  }
  async function describe(def) {
    const key = `${serviceId(def)}:${typeName(def)}`;
    if (!cache.has(key))
      cache.set(
        key,
        requestJSON(url(def, 'DescribeFeatureType'))
          .then((data) => {
            const properties = data.featureTypes?.[0]?.properties || [];
            const geometry = properties.find((property) =>
              /gml:|Geometry|Point|LineString|Polygon|Surface/.test(
                property.type,
              ),
            );
            const fields = properties
              .filter((property) => property !== geometry)
              .map((property) => ({
                name: property.name,
                type: /int|double|float|decimal|long|short/i.test(property.type)
                  ? 'number'
                  : /bool/i.test(property.type)
                    ? 'boolean'
                    : /date|time/i.test(property.type)
                      ? 'date'
                      : 'string',
              }));
            return { fields, geometryName: geometry?.name || 'the_geom' };
          })
          .catch((error) => {
            cache.delete(key);
            throw error;
          }),
      );
    return cache.get(key);
  }
  async function features(def, options = {}) {
    const target = url(def, 'GetFeature');
    const where = toCql(options.where);
    if (where) target.searchParams.set('CQL_FILTER', where);
    target.searchParams.set('srsName', WFS_CRS);
    if (options.limit != null)
      target.searchParams.set('count', String(options.limit));
    if (options.offset)
      target.searchParams.set('startIndex', String(options.offset));
    if (options.sortBy?.length)
      target.searchParams.set(
        'sortBy',
        options.sortBy
          .map(
            (sort) =>
              `${fieldName(sort.field)} ${sort.dir === 'desc' ? 'D' : 'A'}`,
          )
          .join(','),
      );
    const requested =
      options.properties ||
      (options.withGeometry === false
        ? (await describe(def)).fields.map((field) => field.name)
        : undefined);
    if (requested) {
      const names = [...requested];
      if (options.withGeometry !== false)
        names.push((await describe(def)).geometryName);
      target.searchParams.set(
        'propertyName',
        [...new Set(names)].map(fieldName).join(','),
      );
    }
    let data;
    try {
      data = await requestJSON(target, { signal: options.signal });
    } catch (error) {
      if (/natural order/i.test(error.message) && !options.sortBy?.length) {
        const first = (await describe(def)).fields[0];
        if (first)
          return features(def, {
            ...options,
            sortBy: [{ field: first.name, dir: 'asc' }],
          });
      }
      throw error;
    }
    const total = data.numberMatched ?? data.totalFeatures;
    const result = readWfsGeoJSON(data, projection);
    if (options.withGeometry === false)
      result.forEach((feature) => feature.setGeometry(undefined));
    return {
      features: result,
      total:
        total != null && Number.isFinite(Number(total)) ? Number(total) : null,
    };
  }
  return { describe, features };
}
