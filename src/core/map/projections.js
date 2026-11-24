import proj4 from 'proj4';
import { register } from 'ol/proj/proj4.js';
import { get, transform, fromLonLat } from 'ol/proj.js';
import { mapProjection } from './createMap.js';
export function createCrs(config, locale = 'en') {
  const view = mapProjection(config);
  for (const item of config.crs)
    if (item.proj4) proj4.defs(item.code, item.proj4);
  register(proj4);
  for (const item of config.crs) {
    const projection = get(item.code);
    if (!projection) throw new Error(`Unknown projection: ${item.code}`);
    if (item.bbox) projection.setExtent(item.bbox);
    if (item.worldBbox) projection.setWorldExtent(item.worldBbox);
  }
  function format(coordinate, code) {
    const item = config.crs.find((item) => item.code === code);
    const xy = transform(coordinate, view, code);
    const ordered = item.axisOrder === 'ne' ? [xy[1], xy[0]] : xy;
    return ordered
      .map(
        (value, index) =>
          (item.axisLabels?.[index] ? `${item.axisLabels[index]}=` : '') +
          value.toLocaleString(locale, {
            minimumFractionDigits: item.decimals ?? 5,
            maximumFractionDigits: item.decimals ?? 5,
            useGrouping: false,
          }),
      )
      .join('; ');
  }
  const inside = (xy, bbox) =>
    xy[0] >= bbox[0] &&
    xy[0] <= bbox[2] &&
    xy[1] >= bbox[1] &&
    xy[1] <= bbox[3];
  function parse(text) {
    const cleaned =
      text.includes('.') || /^[-+]?\d+,\s*[-+]?\d+$/.test(text.trim())
        ? text.trim()
        : text.trim().replace(/(\d),(\d)/g, '$1.$2');
    const tokens = [
      ...cleaned.matchAll(/([-+]?\d+(?:\.\d+)?)\s*°?\s*([NSEW])?/gi),
    ];
    const values = tokens.map((match) =>
      /[SW]/i.test(match[2] || '')
        ? -Math.abs(Number(match[1]))
        : Number(match[1]),
    );
    if (values.length !== 2 || !values.every(Number.isFinite)) return null;
    const [a, b] = values;
    const bounds = config.crs.map((item) => item.worldBbox).filter(Boolean);
    if (!bounds.length && config.map.extent) bounds.push(config.map.extent);
    const candidates = [...config.crs].sort(
      (a, b) => Number(a.code === 'EPSG:3857') - Number(b.code === 'EPSG:3857'),
    );
    for (const item of candidates) {
      if (
        item.kind === 'geographic' &&
        Math.abs(a) <= 180 &&
        Math.abs(b) <= 180
      ) {
        const orders = /[EW]/i.test(tokens[0][2] || '')
          ? [
              [a, b],
              [b, a],
            ]
          : [
              [b, a],
              [a, b],
            ];
        for (const xy of orders)
          if (
            Math.abs(xy[1]) <= 90 &&
            (!bounds.length || bounds.some((bbox) => inside(xy, bbox)))
          )
            return {
              coordinate: fromLonLat(xy, view),
              code: item.code,
              values: xy,
            };
      } else if (item.kind === 'projected' && item.bbox) {
        for (const xy of [
          [a, b],
          [b, a],
        ])
          if (inside(xy, item.bbox))
            return {
              coordinate: transform(xy, item.code, view),
              code: item.code,
              values: xy,
            };
      }
    }
    return null;
  }
  return { list: () => config.crs, format, parse };
}
