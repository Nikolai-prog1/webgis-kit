import { styleOptions } from '../map/vectorStyle.js';
import { el, safeUrl } from './dom.js';
const ns = 'http://www.w3.org/2000/svg';
let patternSequence = 0;
function svgNode(tag, attributes) {
  const node = document.createElementNS(ns, tag);
  for (const [key, value] of Object.entries(attributes))
    if (value !== undefined && value !== null)
      node.setAttribute(key, String(value));
  return node;
}
const color = (value) =>
  /^(?:#[0-9a-f]{3,8}|[a-z]+|rgba?\([\d.,%\s]+\)|hsla?\([\d.,%\s]+\))$/i.test(
    value || '',
  )
    ? value
    : 'none';
export function legendEntries(def) {
  if (Array.isArray(def.legend)) return def.legend;
  const style = styleOptions(def);
  return [
    {
      type: def.geometry,
      shape: style.shape,
      fill: style.fill,
      fillOpacity: style.fillOpacity,
      stroke: style.stroke,
      strokeWidth: style.strokeWidth,
      dasharray: style.dasharray,
      label: def.title,
    },
  ];
}
export function legendSymbol(item) {
  if (item.type === 'image')
    return el('img', {
      src: safeUrl(item.url),
      alt: '',
      class: 'wg-legend-image',
      loading: 'lazy',
      crossOrigin: 'anonymous',
    });
  const svg = svgNode('svg', {
    viewBox: '0 0 30 20',
    width: 30,
    height: 20,
    'aria-hidden': 'true',
    class: 'wg-legend-symbol',
  });
  const attributes = {
    fill: color(item.fill),
    stroke: color(item.stroke),
    'stroke-width': item.strokeWidth ?? 1.3,
    'fill-opacity': item.fillOpacity ?? 1,
    'stroke-dasharray': item.dasharray?.join?.(' ') || item.dasharray,
  };
  if (item.hatch && item.type === 'polygon') {
    const patternId = `wg-hatch-${++patternSequence}`;
    const pattern = svgNode('pattern', {
      id: patternId,
      width: item.hatch.spacing || 6,
      height: item.hatch.spacing || 6,
      patternUnits: 'userSpaceOnUse',
      patternTransform: `rotate(${Number(item.hatch.angle) || 0})`,
    });
    pattern.append(
      svgNode('path', {
        d: `M0 0 V${item.hatch.spacing || 6}`,
        stroke: color(item.hatch.color || item.stroke),
        'stroke-width': item.hatch.width || 1,
      }),
    );
    const defs = svgNode('defs', {});
    defs.append(pattern);
    svg.append(defs);
    svg.append(
      svgNode('rect', { x: 3, y: 3, width: 24, height: 14, ...attributes }),
    );
    attributes.fill = `url(#${patternId})`;
    attributes['fill-opacity'] = 1;
  }
  if (item.type === 'line')
    svg.append(
      svgNode('path', {
        d: 'M2 15 11 5 19 13 28 5',
        ...attributes,
        fill: 'none',
      }),
    );
  else if (item.type === 'point') {
    if (item.shape === 'square')
      svg.append(
        svgNode('rect', { x: 9, y: 4, width: 12, height: 12, ...attributes }),
      );
    else if (item.shape === 'diamond')
      svg.append(
        svgNode('polygon', { points: '15,2 23,10 15,18 7,10', ...attributes }),
      );
    else if (item.shape === 'triangle')
      svg.append(
        svgNode('polygon', { points: '15,3 23,17 7,17', ...attributes }),
      );
    else svg.append(svgNode('circle', { cx: 15, cy: 10, r: 6, ...attributes }));
  } else
    svg.append(
      svgNode('rect', {
        x: 3,
        y: 3,
        width: 24,
        height: 14,
        rx: 2,
        ...attributes,
      }),
    );
  return svg;
}
/** @param {AppContext} ctx */
export function legendGraphic(ctx, def) {
  const url = new URL(ctx.services.wmsUrl(def.source.service));
  for (const [key, value] of Object.entries({
    SERVICE: 'WMS',
    REQUEST: 'GetLegendGraphic',
    VERSION: '1.1.1',
    FORMAT: 'image/png',
    LAYER: ctx.services.qualified(def.source.service, def.source.layers),
    STYLE: def.source.style || '',
  }))
    url.searchParams.set(key, value);
  return el('img', {
    src: url.href,
    alt: ctx.localized(def.title),
    loading: 'lazy',
    crossOrigin: 'anonymous',
    class: 'wg-legend-image',
  });
}
