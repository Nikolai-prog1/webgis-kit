import { mapZoom } from '../map/createMap.js';
import Feature from 'ol/Feature.js';
import Point from 'ol/geom/Point.js';
import VectorLayer from 'ol/layer/Vector.js';
import VectorSource from 'ol/source/Vector.js';
import { createEmpty, extend, getCenter } from 'ol/extent.js';
import { vectorStyle } from '../map/vectorStyle.js';
import { el, button, template } from '../ui/dom.js';
import { formatValue } from '../ui/format.js';
let sequence = 0;
export function groupFeatures(features, groupBy) {
  if (!groupBy) return features;
  const groups = new Map();
  features.forEach((feature, index) => {
    const key = feature.get(groupBy.field) ?? `missing-${index}`;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(feature);
  });
  return [...groups.values()].map((rows) => {
    const first = rows.find((feature) => feature.getGeometry()) || rows[0];
    const feature = new Feature({
      ...first.getProperties(),
      _wgRows: rows,
      _wgCount: rows.length,
    });
    feature.setGeometry(
      first.getGeometry()
        ? new Point(getCenter(first.getGeometry().getExtent()))
        : undefined,
    );
    return feature;
  });
}
/** @param {AppContext} ctx */
export function createResults(ctx, options, kind) {
  const id = `results-${++sequence}`;
  const entry = ctx.layers.get(options.layer);
  const def = entry.def;
  const source = new VectorSource();
  const layer = new VectorLayer({
    source,
    style: vectorStyle(
      {
        geometry: 'point',
        style: {
          fill: '#e4ab22',
          stroke: '#725108',
          fillOpacity: 0.25,
          radius: 8,
          strokeWidth: 2,
          label: {
            field: options.groupBy
              ? '_wgLabel'
              : options.highlight?.labelField || 'name',
            size: 12,
          },
        },
      },
      ctx.view,
    ),
    zIndex: 4000 + sequence,
  });
  layer.set('wg:auxiliary', true);
  ctx.map.addLayer(layer);
  let panel;
  const details = (feature) =>
    (options.result?.fields || [])
      .map(
        (name) =>
          `${ctx.localized(def.fields?.[name]?.label || name)}: ${formatValue(feature.get(name), def.fields?.[name], ctx.locale, ctx.t)}`,
      )
      .join(' · ');
  function focus(feature) {
    const geometry = feature.getGeometry();
    if (
      geometry &&
      geometry.getExtent().every(Number.isFinite) &&
      options.zoomTo !== false
    )
      ctx.view.fit(geometry.getExtent(), {
        maxZoom: mapZoom(ctx.view, options.maxZoom || 12),
        padding: [70, 70, 70, 70],
        duration: matchMedia('(prefers-reduced-motion: reduce)').matches
          ? 0
          : 350,
      });
    const rows = feature.get('_wgRows');
    const coordinate = geometry
      ? getCenter(geometry.getExtent())
      : ctx.view.getCenter();
    if (rows && !ctx.ui.popup.formatters.has(def.popup?.formatter))
      ctx.ui.popup.show({
        coordinate,
        title: ctx.t('search.results', { count: rows.length }),
        rows: rows.map((row, index) => [
          String(index + 1),
          template(
            ctx.localized(options.result?.title || '{name}'),
            row.getProperties(),
          ) +
            (options.result?.subtitle
              ? ` · ${template(ctx.localized(options.result.subtitle), row.getProperties())}`
              : '') +
            (details(row) ? ` · ${details(row)}` : ''),
        ]),
      });
    else ctx.ui.popup.showFeature(def, feature, coordinate);
  }
  const off = ctx.clicks.register({
    id,
    priority: 50,
    handle(event) {
      if (ctx.tools.active()) return false;
      let found;
      ctx.map.forEachFeatureAtPixel(
        event.pixel,
        (feature, hitLayer) => {
          if (hitLayer === layer) found = feature;
        },
        { layerFilter: (hitLayer) => hitLayer === layer, hitTolerance: 5 },
      );
      if (found) {
        focus(found);
        return true;
      }
      return false;
    },
  });
  const result = {
    show(features, total = features.length) {
      source.clear();
      panel?.close();
      ctx.ui.popup.close();
      const replacement = ctx.hooks.emit(`${kind}:results`, {
        block: options,
        features,
      });
      if (Array.isArray(replacement)) features = replacement;
      if (!features.length) {
        ctx.ui.toast(ctx.t('search.noResults'));
        return;
      }
      if (options.showLayerOnSearch) ctx.layers.setVisible(def.id, true);
      const missing = features.filter(
        (feature) => !feature.getGeometry(),
      ).length;
      if (missing)
        ctx.ui.toast(
          ctx.t('search.missingGeometry', { count: missing }),
          'warning',
        );
      const display = groupFeatures(features, options.groupBy);
      const extent = createEmpty();
      for (const feature of display) {
        const copy = feature.clone();
        copy.setId(feature.getId());
        if (options.groupBy)
          copy.set(
            '_wgLabel',
            template(ctx.localized(options.groupBy.countLabel || '{count}'), {
              count: feature.get('_wgCount'),
            }),
          );
        source.addFeature(copy);
        if (copy.getGeometry()?.getExtent().every(Number.isFinite))
          extend(extent, copy.getGeometry().getExtent());
      }
      if (extent.every(Number.isFinite) && options.zoomTo !== false)
        ctx.view.fit(extent, {
          padding: [70, 70, 70, 70],
          maxZoom: mapZoom(ctx.view, options.maxZoom || 12),
          duration: matchMedia('(prefers-reduced-motion: reduce)').matches
            ? 0
            : 350,
        });
      if (display.length === 1) {
        focus(display[0]);
        return;
      }
      const list = el('div', { class: 'wg-results' });
      for (const feature of display) {
        const properties = feature.getProperties();
        const row = button('', () => focus(feature), { class: 'wg-result' });
        row.append(
          el('strong', {
            text: template(
              ctx.localized(options.result?.title || '{name}'),
              properties,
            ),
          }),
        );
        if (options.result?.subtitle)
          row.append(
            el('small', {
              text: template(
                ctx.localized(options.result.subtitle),
                properties,
              ),
            }),
          );
        if (options.groupBy) {
          row.append(
            el('small', {
              text: ctx.t('items', { count: feature.get('_wgCount') }),
            }),
          );
          for (const original of feature.get('_wgRows'))
            row.append(
              el('small', {
                text:
                  template(
                    ctx.localized(options.result?.title || '{name}'),
                    original.getProperties(),
                  ) + (details(original) ? ` · ${details(original)}` : ''),
              }),
            );
        } else if (details(feature))
          row.append(el('small', { text: details(feature) }));
        if (!feature.getGeometry())
          row.append(el('small', { text: ctx.t('app.noGeometry') }));
        list.append(row);
      }
      panel = ctx.ui.panels.create({
        id,
        title: ctx.t('search.results', { count: total ?? features.length }),
        content: list,
        persist: false,
        onClose() {
          source.clear();
          ctx.ui.popup.close();
        },
      });
    },
    clear() {
      source.clear();
      panel?.close();
      ctx.ui.popup.close();
    },
    dispose() {
      off();
      source.clear();
      ctx.map.removeLayer(layer);
      panel?.dispose();
    },
  };
  const clearOff = ctx.hooks.on('map:clear', () => result.clear());
  const dispose = result.dispose;
  result.dispose = () => {
    clearOff();
    dispose();
  };
  return result;
}
