import TileLayer from 'ol/layer/Tile.js';
import ImageLayer from 'ol/layer/Image.js';
import VectorLayer from 'ol/layer/Vector.js';
import TileWMS from 'ol/source/TileWMS.js';
import ImageWMS from 'ol/source/ImageWMS.js';
import VectorSource from 'ol/source/Vector.js';
import XYZ from 'ol/source/XYZ.js';
import GeoJSON from 'ol/format/GeoJSON.js';
import { bbox, all } from 'ol/loadingstrategy.js';
import { TileState } from './tileState.js';
import { vectorStyle } from './vectorStyle.js';
import { requestJSON } from '../data/http.js';
import { readWfsGeoJSON, wfsBbox, WFS_CRS } from '../data/wfsGeoJSON.js';
import { resolveUrl } from '../config/urls.js';
import { escapeHtml } from '../ui/dom.js';
import { getPointResolution } from 'ol/proj.js';
import { compensatedDpi } from './scaleCompensation.js';

export const transparentPixel =
  'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAAC0lEQVR42mNgAAIAAAUAAen63NgAAAAASUVORK5CYII=';
export function emptyException(text, patterns = []) {
  return patterns.some((pattern) => new RegExp(pattern, 'i').test(text));
}
export async function wmsImageResponse(response, patterns = []) {
  const blob = await response.blob();
  if (!blob.type.startsWith('image/')) {
    if (emptyException(await blob.text(), patterns)) return null;
    throw new Error('Expected a WMS image');
  }
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  return blob;
}
/** @param {AppContext} ctx */
export function createLayerFactory(ctx) {
  const format = new GeoJSON();
  function monitor(source, def) {
    const prefix =
      source instanceof TileWMS || source instanceof XYZ
        ? 'tile'
        : source instanceof ImageWMS
          ? 'image'
          : 'features';
    source.on(`${prefix}loadstart`, () => ctx.ui.loading.begin());
    source.on(`${prefix}loadend`, () => ctx.ui.loading.end());
    source.on(`${prefix}loaderror`, () => {
      ctx.ui.loading.end();
      error(def);
    });
  }
  function error(def) {
    ctx.ui.toast(
      ctx.t('layer.error', {
        title: ctx.localized(def.title),
        service: def.source.service
          ? ctx.localized(
              ctx.services.get(def.source.service).title || def.source.service,
            )
          : def.source.url,
      }),
      'error',
    );
  }
  function imageLoader(patterns) {
    return async (imageTile, url) => {
      try {
        const blob = await wmsImageResponse(
          await fetch(url, { signal: AbortSignal.timeout(30000) }),
          patterns,
        );
        if (!blob) {
          imageTile.getImage().src = transparentPixel;
          return;
        }
        const objectUrl = URL.createObjectURL(blob);
        const image = imageTile.getImage();
        image.addEventListener('load', () => URL.revokeObjectURL(objectUrl), {
          once: true,
        });
        image.addEventListener('error', () => URL.revokeObjectURL(objectUrl), {
          once: true,
        });
        image.src = objectUrl;
      } catch {
        if (typeof imageTile.setState === 'function')
          imageTile.setState(TileState.ERROR);
        else imageTile.getImage().src = 'data:,';
      }
    };
  }
  function create(def, label = false) {
    const sourceDef = def.source;
    let source, layer;
    let ready = Promise.resolve();
    if (sourceDef.type === 'wms') {
      const service = ctx.services.get(sourceDef.service);
      const params = {
        VERSION: service.wmsVersion || '1.1.1',
        LAYERS: ctx.services.qualified(sourceDef.service, sourceDef.layers),
        STYLES: label ? sourceDef.labelStyle : sourceDef.style || '',
        TRANSPARENT: true,
        FORMAT: 'image/png',
        ...sourceDef.params,
      };
      const common = {
        url: ctx.services.wmsUrl(sourceDef.service),
        params,
        projection: sourceDef.projection || service.projection,
        serverType:
          service.serverType ||
          (service.type === 'geoserver' ? 'geoserver' : undefined),
        crossOrigin: 'anonymous',
        hidpi: sourceDef.hidpi ?? false,
        attributions: escapeHtml(ctx.localized(def.attribution)) || undefined,
      };
      const loader = sourceDef.emptyOnException?.length
        ? imageLoader(sourceDef.emptyOnException)
        : undefined;
      if (sourceDef.tiled !== false) {
        source = new TileWMS({ ...common, tileLoadFunction: loader });
        layer = new TileLayer({ source });
      } else {
        source = new ImageWMS({
          ...common,
          ratio: 1,
          imageLoadFunction: loader,
        });
        layer = new ImageLayer({ source });
      }
      if (sourceDef.scaleCompensation && service.serverType === 'mapserver') {
        const update = () => {
          const resolution = getPointResolution(
            ctx.view.getProjection(),
            ctx.view.getResolution(),
            ctx.view.getCenter(),
            'm',
          );
          const dpi = compensatedDpi(
            resolution,
            def.maxScale,
            def.minScale,
            96 * (globalThis.devicePixelRatio || 1),
          );
          source.updateParams({
            DPI: dpi,
            MAP_RESOLUTION: dpi,
            FORMAT_OPTIONS: `dpi:${dpi}`,
          });
        };
        update();
        ctx.view.on('change:resolution', update);
      }
    } else if (sourceDef.type === 'xyz') {
      source = new XYZ({
        url: resolveUrl(sourceDef.url),
        crossOrigin: 'anonymous',
        attributions: escapeHtml(
          ctx.localized(sourceDef.attribution || def.attribution),
        ),
      });
      layer = new TileLayer({ source });
    } else {
      source = new VectorSource({
        strategy: sourceDef.strategy === 'bbox' ? bbox : all,
        attributions: escapeHtml(ctx.localized(def.attribution)) || undefined,
      });
      layer = new VectorLayer({ source, style: vectorStyle(def, ctx.view) });
      if (sourceDef.type === 'geojson' || sourceDef.strategy === 'all') {
        ctx.ui.loading.begin();
        let url;
        if (sourceDef.type === 'geojson')
          url = new URL(sourceDef.url, document.baseURI).href;
        else {
          url = new URL(ctx.services.wfsUrl(sourceDef.service));
          url.search = new URLSearchParams({
            service: 'WFS',
            version: '2.0.0',
            request: 'GetFeature',
            typeNames: ctx.services.qualified(
              sourceDef.service,
              sourceDef.typeName,
            ),
            outputFormat: 'application/json',
            count: String(sourceDef.maxFeatures || 5000),
            srsName: WFS_CRS,
          }).toString();
        }
        ready = requestJSON(url)
          .then((data) => {
            source.addFeatures(
              sourceDef.type === 'wfs'
                ? readWfsGeoJSON(data, ctx.view.getProjection())
                : format.readFeatures(data, {
                    dataProjection:
                      sourceDef.dataProjection ||
                      (sourceDef.type === 'wfs'
                        ? ctx.view.getProjection()
                        : 'EPSG:4326'),
                    featureProjection: ctx.view.getProjection(),
                  }),
            );
          })
          .catch((err) => {
            error(def);
            throw err;
          })
          .finally(() => ctx.ui.loading.end());
        ready.catch(() => {});
      } else if (sourceDef.type === 'wfs') {
        source.setLoader(
          (extent, _resolution, projection, success, failure) => {
            void (async () => {
              try {
                const url = new URL(ctx.services.wfsUrl(sourceDef.service));
                url.search = new URLSearchParams({
                  service: 'WFS',
                  version: '2.0.0',
                  request: 'GetFeature',
                  typeNames: ctx.services.qualified(
                    sourceDef.service,
                    sourceDef.typeName,
                  ),
                  outputFormat: 'application/json',
                  count: String(sourceDef.maxFeatures || 5000),
                  srsName: WFS_CRS,
                  bbox: wfsBbox(extent, projection),
                }).toString();
                const features = readWfsGeoJSON(
                  await requestJSON(url),
                  projection,
                );
                source.addFeatures(features);
                success?.(features);
              } catch {
                source.removeLoadedExtent(extent);
                failure?.();
              }
            })();
          },
        );
      }
    }
    if (
      !(source instanceof VectorSource) ||
      (sourceDef.type === 'wfs' && sourceDef.strategy !== 'all')
    )
      monitor(source, def);
    layer.setVisible(!!def.visible);
    layer.setOpacity(def.opacity ?? 1);
    layer.set('wg:id', def.id);
    layer.set('wg:auxiliary', label);
    return { layer, ready };
  }
  return { create };
}
