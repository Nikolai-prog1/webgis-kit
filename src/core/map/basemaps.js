import TileLayer from 'ol/layer/Tile.js';
import OSM from 'ol/source/OSM.js';
import XYZ from 'ol/source/XYZ.js';
import TileWMS from 'ol/source/TileWMS.js';
import { resolveUrl } from '../config/urls.js';
import { escapeHtml } from '../ui/dom.js';
/** @param {AppContext} ctx */
export function createBasemaps(ctx) {
  const config = ctx.config.basemaps;
  const stored = ctx.storage.get('basemap.id');
  let selected =
    (stored === 'none' && config.allowNone) ||
    config.items.some((item) => item.id === stored)
      ? stored
      : config.default;
  let opacity = Math.max(
    0,
    Math.min(1, Number(ctx.storage.get('basemap.opacity', 1))),
  );
  const layers = new Map();
  for (const [index, item] of config.items.entries()) {
    let source;
    if (item.type === 'osm') source = new OSM({ crossOrigin: 'anonymous' });
    else if (item.type === 'xyz')
      source = new XYZ({
        url: resolveUrl(item.url),
        attributions: escapeHtml(ctx.localized(item.attribution)),
        maxZoom: item.maxZoom,
        crossOrigin: 'anonymous',
      });
    else
      source = new TileWMS({
        url: ctx.services.wmsUrl(item.service),
        params: {
          LAYERS: ctx.services.qualified(item.service, item.layers),
          STYLES: item.style || '',
          VERSION: ctx.services.get(item.service).wmsVersion || '1.1.1',
        },
        crossOrigin: 'anonymous',
      });
    const layer = new TileLayer({
      source,
      visible: item.id === selected,
      opacity,
      zIndex: Math.min(index, 9),
    });
    layer.set('wg:basemap', item);
    ctx.map.addLayer(layer);
    layers.set(item.id, layer);
  }
  return {
    layers,
    selected: () => selected,
    opacity: () => opacity,
    select(id) {
      selected = id;
      layers.forEach((layer, key) => layer.setVisible(key === id));
      ctx.storage.set('basemap.id', id);
    },
    setOpacity(value) {
      opacity = value;
      layers.forEach((layer) => layer.setOpacity(value));
      ctx.storage.set('basemap.opacity', value);
    },
  };
}
