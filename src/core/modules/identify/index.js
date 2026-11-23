import GeoJSON from 'ol/format/GeoJSON.js';
import WMSGetFeatureInfo from 'ol/format/WMSGetFeatureInfo.js';
import VectorLayer from 'ol/layer/Vector.js';
import { request, ogcException } from '../../data/http.js';
export default {
  id: 'identify',
  kind: 'global',
  setup(ctx) {
    async function identify(event, signal, hover = false) {
      if (ctx.tools.active()) return false;
      const entries = ctx.layers
        .all()
        .filter((entry) => entry.layer?.getVisible() && entry.def.queryable)
        .sort((a, b) => b.layer.getZIndex() - a.layer.getZIndex());
      for (const entry of entries) {
        if (signal?.aborted) return false;
        let features = [];
        if (entry.layer instanceof VectorLayer)
          ctx.map.forEachFeatureAtPixel(
            event.pixel,
            (feature, layer) => {
              if (layer === entry.layer) features.push(feature);
            },
            { hitTolerance: 5, layerFilter: (layer) => layer === entry.layer },
          );
        else if (entry.def.source.type === 'wms') {
          const source = entry.layer.getSource();
          for (const format of [
            'application/json',
            'application/vnd.ogc.gml',
            'text/plain',
          ]) {
            try {
              const url = source.getFeatureInfoUrl(
                event.coordinate,
                ctx.view.getResolution(),
                ctx.view.getProjection(),
                {
                  INFO_FORMAT: format,
                  FEATURE_COUNT: ctx.config.identify.featureCount,
                  BUFFER: ctx.config.identify.buffer,
                },
              );
              if (!url) continue;
              const text = await (await request(url, { signal })).text();
              signal?.throwIfAborted();
              const exception = ogcException(text);
              if (exception) continue;
              if (format === 'application/json') {
                const data = JSON.parse(text);
                if (!(
                  data.type === 'Feature' ||
                  (data.type === 'FeatureCollection' &&
                    Array.isArray(data.features))
                ))
                  throw new Error('Unreadable JSON feature info');
                features = new GeoJSON().readFeatures(data, {
                  featureProjection: ctx.view.getProjection(),
                });
              } else if (format.includes('gml')) {
                const xml = new DOMParser().parseFromString(text, 'text/xml');
                if (
                  !['FeatureCollection', 'msGMLOutput'].includes(
                    xml.documentElement.localName,
                  ) ||
                  xml.getElementsByTagNameNS('*', 'parsererror').length
                )
                  throw new Error('Unreadable GML feature info');
                features = new WMSGetFeatureInfo().readFeatures(text, {
                  featureProjection: ctx.view.getProjection(),
                });
              } else if (text.trim() && !/no (features|results)/i.test(text)) {
                if (!hover && !signal?.aborted)
                  ctx.ui.popup.show({
                    coordinate: event.coordinate,
                    title: ctx.localized(entry.def.title),
                    rows: [[ctx.localized(entry.def.title), text]],
                  });
                return true;
              }
              break;
            } catch (error) {
              if (error.name === 'AbortError') return false;
            }
          }
        }
        if (features.length) {
          if (signal?.aborted) return false;
          if (!hover) {
            const handled = ctx.hooks.emit('identify:result', {
              layer: entry.def,
              features,
              coordinate: event.coordinate,
            });
            if (!signal?.aborted && handled !== true)
              ctx.ui.popup.showFeature(
                entry.def,
                features[0],
                event.coordinate,
              );
          }
          return true;
        }
      }
      return false;
    }
    let controller;
    const off = ctx.clicks.register({
      id: 'identify',
      priority: 0,
      handle: (event) => {
        controller?.abort();
        controller = new AbortController();
        return identify(event, controller.signal);
      },
    });
    let timer;
    let hoverController;
    const hover = ctx.config.identify.hoverCursor
      ? ctx.map.on('pointermove', (event) => {
          clearTimeout(timer);
          hoverController?.abort();
          timer = setTimeout(async () => {
            const requestController = new AbortController();
            hoverController = requestController;
            const found = await identify(event, requestController.signal, true);
            if (!requestController.signal.aborted)
              ctx.map.getTargetElement().style.cursor = found ? 'pointer' : '';
          }, 120);
        })
      : null;
    const cancel = () => {
      controller?.abort();
      hoverController?.abort();
      clearTimeout(timer);
      ctx.map.getTargetElement().style.cursor = '';
    };
    const clearOff = ctx.hooks.on('map:clear', cancel);
    return {
      dispose() {
        off();
        clearOff();
        cancel();
        if (hover) ctx.map.un('pointermove', hover.listener);
      },
    };
  },
};
