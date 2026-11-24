import OLMap from 'ol/Map.js';
import View from 'ol/View.js';
import { fromLonLat, transformExtent } from 'ol/proj.js';
export const mapProjection = (config) => config.map.projection || 'EPSG:3857';
export function createMap(config, target) {
  const projection = mapProjection(config);
  const view = new View({
    projection,
    center: fromLonLat(config.map.center, projection),
    zoom: config.map.zoom,
    minZoom: config.map.minZoom,
    maxZoom: config.map.maxZoom,
    extent: config.map.extent
      ? transformExtent(config.map.extent, 'EPSG:4326', projection)
      : undefined,
  });
  const map = new OLMap({ target, view });
  // Fit the data's home extent to the actual window once it has a size, so
  // the first view frames the data whatever the screen or projection.
  if (config.map.openAtHome && config.map.homeExtent) {
    const home = transformExtent(
      config.map.homeExtent,
      'EPSG:4326',
      projection,
    );
    const fit = () => view.fit(home, { padding: [25, 25, 25, 25] });
    if (map.getSize()?.every((value) => value > 0)) fit();
    else map.once('change:size', fit);
  }
  return { map, view };
}
