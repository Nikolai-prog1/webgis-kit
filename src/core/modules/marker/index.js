import Feature from 'ol/Feature.js';
import Point from 'ol/geom/Point.js';
import Overlay from 'ol/Overlay.js';
import VectorSource from 'ol/source/Vector.js';
import VectorLayer from 'ol/layer/Vector.js';
import Style from 'ol/style/Style.js';
import Icon from 'ol/style/Icon.js';
import { el, button } from '../../ui/dom.js';
import { copyText } from '../../ui/clipboard.js';
/** @param {AppContext} ctx */
export function ensureMarkers(ctx) {
  if (ctx.markers) return ctx.markers;
  const source = new VectorSource();
  const svg =
    '<svg xmlns="http://www.w3.org/2000/svg" width="30" height="40" viewBox="0 0 30 40"><path d="M15 38C12 29 2 23 2 15a13 13 0 0 1 26 0c0 8-10 14-13 23Z" fill="#17655b" stroke="white" stroke-width="2"/><circle cx="15" cy="15" r="4" fill="white"/></svg>';
  const layer = new VectorLayer({
    source,
    zIndex: 7000,
    style: new Style({
      image: new Icon({
        src: `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`,
        anchor: [0.5, 1],
      }),
    }),
  });
  layer.set('wg:auxiliary', true);
  ctx.map.addLayer(layer);
  const records = [];
  function remove(record) {
    source.removeFeature(record.feature);
    ctx.map.removeOverlay(record.overlay);
    const index = records.indexOf(record);
    if (index >= 0) records.splice(index, 1);
    const annotation = ctx.annotations.indexOf(record);
    if (annotation >= 0) ctx.annotations.splice(annotation, 1);
  }
  const markers = {
    add(coordinate) {
      const feature = new Feature({ geometry: new Point(coordinate) });
      source.addFeature(feature);
      const card = el('div', { class: 'wg-marker-card' });
      const lines = [];
      for (const item of ctx.crs.list()) {
        const value = ctx.crs.format(coordinate, item.code);
        lines.push(`${ctx.localized(item.label || item.code)}: ${value}`);
        card.append(
          el(
            'div',
            { class: 'wg-row' },
            el(
              'span',
              {},
              el('strong', { text: ctx.localized(item.label || item.code) }),
              el('small', { text: value }),
            ),
            button(
              '⧉',
              () =>
                copyText(value).then(() => ctx.ui.toast(ctx.t('app.copied'))),
              { 'aria-label': ctx.t('app.copy') },
            ),
          ),
        );
      }
      const overlay = new Overlay({
        element: card,
        position: coordinate,
        offset: [16, -26],
        positioning: 'bottom-left',
      });
      const record = {
        feature,
        overlay,
        element: card,
        text: lines.join('\n'),
        kind: 'marker',
      };
      card.append(button(ctx.t('app.remove'), () => remove(record)));
      ctx.map.addOverlay(overlay);
      records.push(record);
      ctx.annotations.push(record);
      return record;
    },
    clear() {
      records.slice().forEach(remove);
    },
    dispose() {
      markers.clear();
      ctx.map.removeLayer(layer);
    },
  };
  const off = ctx.hooks.on('map:clear', () => markers.clear());
  ctx.disposables.push({
    dispose() {
      off();
      markers.dispose();
    },
  });
  ctx.markers = markers;
  return markers;
}
export default {
  id: 'marker',
  kind: 'tool',
  setup(ctx) {
    const markers = ensureMarkers(ctx);
    const off = ctx.clicks.register({
      id: 'marker',
      priority: 100,
      handle(event) {
        if (ctx.tools.active() !== 'marker') return false;
        markers.add(event.coordinate);
        return true;
      },
    });
    const key = (event) => {
      if (
        event.key === 'Enter' &&
        ctx.tools.active() === 'marker' &&
        event.target === ctx.map.getTargetElement()
      ) {
        event.preventDefault();
        markers.add(ctx.view.getCenter());
      }
    };
    ctx.map.getTargetElement().addEventListener('keydown', key);
    ctx.ui.toolbar.registerTool({
      id: 'marker',
      icon: 'ti-map-pin',
      exclusive: true,
    });
    return {
      dispose() {
        off();
        ctx.map.getTargetElement().removeEventListener('keydown', key);
      },
    };
  },
};
