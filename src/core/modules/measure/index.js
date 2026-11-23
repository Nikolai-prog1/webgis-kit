import Draw from 'ol/interaction/Draw.js';
import VectorLayer from 'ol/layer/Vector.js';
import VectorSource from 'ol/source/Vector.js';
import Overlay from 'ol/Overlay.js';
import Polygon from 'ol/geom/Polygon.js';
import LineString from 'ol/geom/LineString.js';
import { getLength, getArea } from 'ol/sphere.js';
import { unByKey } from 'ol/Observable.js';
import { vectorStyle } from '../../map/vectorStyle.js';
import { distanceLabel, areaLabel } from '../../map/units.js';
import { el, button } from '../../ui/dom.js';
export default {
  id: 'measure',
  toolIds: ['measure-distance', 'measure-area'],
  kind: 'tool',
  setup(ctx, options) {
    const polygon = options.id === 'measure-area';
    const source = new VectorSource();
    const layer = new VectorLayer({
      source,
      zIndex: 6000,
      style: vectorStyle(
        {
          geometry: polygon ? 'polygon' : 'line',
          style: {
            fill: '#17655b',
            fillOpacity: 0.12,
            stroke: '#17655b',
            strokeWidth: 2,
            dasharray: [6, 4],
          },
        },
        ctx.view,
      ),
    });
    layer.set('wg:auxiliary', true);
    ctx.map.addLayer(layer);
    const draw = new Draw({ source, type: polygon ? 'Polygon' : 'LineString' });
    const records = [];
    let live,
      geometryKey,
      vertices = 0;
    function remove(record) {
      source.removeFeature(record.feature);
      ctx.map.removeOverlay(record.overlay);
      const saved = records.indexOf(record);
      if (saved >= 0) records.splice(saved, 1);
      const index = ctx.annotations.indexOf(record);
      if (index >= 0) ctx.annotations.splice(index, 1);
    }
    draw.on('drawstart', (event) => {
      vertices = 1;
      const element = el('div', { class: 'wg-measure-label' });
      const overlay = new Overlay({
        element,
        offset: [0, -12],
        positioning: 'bottom-center',
        stopEvent: false,
      });
      ctx.map.addOverlay(overlay);
      live = {
        feature: event.feature,
        overlay,
        element,
        text: '',
        kind: 'measure',
      };
      const geometry = event.feature.getGeometry();
      const update = () => {
        const coordinate =
          geometry instanceof Polygon
            ? geometry.getInteriorPoint().getCoordinates()
            : geometry instanceof LineString
              ? geometry.getLastCoordinate()
              : ctx.view.getCenter();
        const text = polygon
          ? areaLabel(
              getArea(geometry, { projection: ctx.view.getProjection() }),
              ctx.locale,
            )
          : distanceLabel(
              getLength(geometry, { projection: ctx.view.getProjection() }),
              ctx.locale,
            );
        element.textContent = text;
        overlay.setPosition(coordinate);
        live.text = text;
      };
      geometryKey = geometry.on('change', update);
      update();
    });
    draw.on('drawend', () => {
      unByKey(geometryKey);
      geometryKey = null;
      const record = live;
      record.element.classList.add('wg-measure-label--finished');
      const position = record.overlay.getPosition();
      ctx.map.removeOverlay(record.overlay);
      // Finished controls belong to the event-stopping container so removing
      // a measurement cannot add a drawing vertex or trigger another tool.
      record.overlay = new Overlay({
        element: record.element,
        position,
        offset: [0, -12],
        positioning: 'bottom-center',
      });
      record.element.append(
        button(
          '×',
          () => {
            remove(record);
            ctx.map.getTargetElement().focus({ preventScroll: true });
          },
          {
            class: 'wg-measure-remove',
            'aria-label': ctx.t('measure.remove'),
            title: ctx.t('measure.remove'),
          },
        ),
      );
      ctx.map.addOverlay(record.overlay);
      records.push(record);
      ctx.annotations.push(record);
      live = null;
      vertices = 0;
    });
    draw.on('drawabort', () => {
      if (live) {
        remove(live);
        live = null;
      }
      if (geometryKey) unByKey(geometryKey);
      geometryKey = null;
      vertices = 0;
    });
    const off = ctx.clicks.register({
      id: options.id,
      priority: 100,
      handle: () => ctx.tools.active() === options.id,
    });
    const clear = () => {
      draw.abortDrawing();
      source.clear();
      records.slice().forEach(remove);
    };
    const clearOff = ctx.hooks.on('map:clear', clear);
    const key = (event) => {
      if (
        ctx.tools.active() !== options.id ||
        event.target !== ctx.map.getTargetElement()
      )
        return;
      if (event.key === ' ') {
        event.preventDefault();
        draw.appendCoordinates([ctx.view.getCenter()]);
        vertices++;
      }
      if (event.key === 'Enter' && vertices >= (polygon ? 3 : 2)) {
        event.preventDefault();
        draw.finishDrawing();
      }
    };
    ctx.map.getTargetElement().addEventListener('keydown', key);
    ctx.ui.toolbar.registerTool({
      id: options.id,
      icon: polygon ? 'ti-polygon' : 'ti-ruler-measure',
      exclusive: true,
      onActivate() {
        ctx.map.addInteraction(draw);
        ctx.ui.toast(ctx.t('tool.finish'));
      },
      onDeactivate() {
        draw.abortDrawing();
        ctx.map.removeInteraction(draw);
      },
    });
    return {
      dispose() {
        off();
        clearOff();
        clear();
        ctx.map.getTargetElement().removeEventListener('keydown', key);
        ctx.map.removeInteraction(draw);
        ctx.map.removeLayer(layer);
      },
    };
  },
};
