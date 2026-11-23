import GeoJSON from 'ol/format/GeoJSON.js';
import { get, transformExtent } from 'ol/proj.js';

export const WFS_CRS = 'EPSG:4326';
const maxLatitude = 85.0511287798066;
function clampCoordinates(coordinates) {
  if (typeof coordinates[0] === 'number')
    return [
      coordinates[0],
      Math.max(-maxLatitude, Math.min(maxLatitude, coordinates[1])),
      ...coordinates.slice(2),
    ];
  return coordinates.map(clampCoordinates);
}
function clampGeometry(geometry) {
  if (!geometry) return geometry;
  return geometry.type === 'GeometryCollection'
    ? { ...geometry, geometries: geometry.geometries.map(clampGeometry) }
    : { ...geometry, coordinates: clampCoordinates(geometry.coordinates) };
}
export function readWfsGeoJSON(data, featureProjection) {
  if (get(featureProjection)?.getCode() === 'EPSG:3857') {
    if (data.type === 'FeatureCollection')
      data = {
        ...data,
        features: data.features.map((feature) => ({
          ...feature,
          geometry: clampGeometry(feature.geometry),
        })),
      };
    else if (data.type === 'Feature')
      data = { ...data, geometry: clampGeometry(data.geometry) };
    else data = clampGeometry(data);
  }
  return new GeoJSON().readFeatures(data, {
    dataProjection: WFS_CRS,
    featureProjection,
  });
}
// Features read in EPSG:4326: clip latitudes for Web Mercator, then project.
export function projectGeographicFeatures(features, featureProjection) {
  const mercator = get(featureProjection)?.getCode() === 'EPSG:3857';
  for (const feature of features) {
    const geometry = feature.getGeometry();
    if (!geometry) continue;
    if (mercator)
      geometry.applyTransform((input, output = input, stride = 2) => {
        for (let i = 0; i < input.length; i += stride) {
          output[i] = input[i];
          output[i + 1] = Math.max(
            -maxLatitude,
            Math.min(maxLatitude, input[i + 1]),
          );
          for (let j = 2; j < stride; j++) output[i + j] = input[i + j];
        }
        return output;
      });
    geometry.transform(WFS_CRS, featureProjection);
  }
  return features;
}
export function wfsBbox(extent, projection) {
  return `${transformExtent(extent, projection, WFS_CRS).join(',')},${WFS_CRS}`;
}
