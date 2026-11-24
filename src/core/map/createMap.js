import OLMap from 'ol/Map.js';
import View from 'ol/View.js';
import {
  fromLonLat,
  transformExtent,
  getPointResolution,
  get as getProjection,
} from 'ol/proj.js';
export const mapProjection = (config) => config.map.projection || 'EPSG:3857';
const MERCATOR_ZOOM_0 = 156543.03392804097;
// Zoom numbers in configuration and tools are Web Mercator zoom levels (the
// scale everyone knows from web maps). In another projection the same number
// means a different scale, so it is converted to the zoom that shows the same
// ground resolution at the given longitude/latitude.
export function zoomIn(projection, zoom, lonLat) {
  const code = getProjection(projection)?.getCode() || projection;
  if (zoom === undefined || zoom === null || code === 'EPSG:3857') return zoom;
  const latitude = Math.max(-85, Math.min(85, lonLat?.[1] ?? 0));
  const ground =
    (MERCATOR_ZOOM_0 / 2 ** zoom) * Math.cos((latitude * Math.PI) / 180);
  const center = fromLonLat(lonLat || [0, 0], code);
  const perUnit = getPointResolution(code, 1, center, 'm');
  const view = new View({ projection: code });
  return view.getZoomForResolution(ground / perUnit);
}
/** Converts a Web Mercator zoom level for the current view. */
export function mapZoom(view, zoom) {
  const projection = view.getProjection();
  if (projection.getCode() === 'EPSG:3857') return zoom;
  const center = view.getCenter();
  const lonLat = center
    ? transformExtent([...center, ...center], projection, 'EPSG:4326').slice(
        0,
        2,
      )
    : [0, 0];
  return zoomIn(projection, zoom, lonLat);
}
export function createMap(config, target) {
  const projection = mapProjection(config);
  const at = (zoom) => zoomIn(projection, zoom, config.map.center);
  const view = new View({
    projection,
    center: fromLonLat(config.map.center, projection),
    zoom: at(config.map.zoom),
    minZoom: at(config.map.minZoom),
    maxZoom: at(config.map.maxZoom),
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
