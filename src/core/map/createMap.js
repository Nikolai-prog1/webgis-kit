import OLMap from 'ol/Map.js';
import View from 'ol/View.js';
import { fromLonLat, transformExtent } from 'ol/proj.js';
export function createMap(config, target) {
  const view = new View({
    center: fromLonLat(config.map.center),
    zoom: config.map.zoom,
    minZoom: config.map.minZoom,
    maxZoom: config.map.maxZoom,
    extent: config.map.extent
      ? transformExtent(config.map.extent, 'EPSG:4326', 'EPSG:3857')
      : undefined,
  });
  const map = new OLMap({ target, view });
  return { map, view };
}
