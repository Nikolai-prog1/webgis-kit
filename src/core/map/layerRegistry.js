import { allLayerDefs } from '../config/normalize.js';
import { zIndex } from './zIndex.js';
import { createHooks } from '../app/hooks.js';
/** @param {AppContext} ctx */
export function createLayerRegistry(ctx, factory) {
  const events = createHooks();
  const entries = new Map();
  allLayerDefs(ctx.config).forEach((def, index) =>
    entries.set(def.id, { def, index, layer: null, label: null, ready: null }),
  );
  const registry = {
    get: (id) => entries.get(id),
    all: () => [...entries.values()],
    byCatalog: (id) =>
      [...entries.values()].filter((entry) => entry.def.catalogId === id),
    add(def) {
      if (entries.has(def.id)) throw new Error(`Duplicate layer: ${def.id}`);
      const entry = {
        def,
        index: entries.size,
        layer: null,
        label: null,
        ready: null,
      };
      entries.set(def.id, entry);
      return entry;
    },
    ensure(id) {
      const entry = entries.get(id);
      if (!entry) throw new Error(`Unknown layer: ${id}`);
      if (!entry.layer) {
        const created = factory.create(entry.def);
        entry.layer = created.layer;
        entry.ready = created.ready;
        entry.layer.setZIndex(zIndex(entry.def, entry.index));
        ctx.map.addLayer(entry.layer);
        if (entry.def.source.labelStyle) {
          entry.label = factory.create(entry.def, true).layer;
          entry.label.setZIndex(entry.layer.getZIndex() + 2000);
          ctx.map.addLayer(entry.label);
        }
        entry.layer.on('change:visible', () => {
          entry.label?.setVisible(entry.layer.getVisible());
          events.emit('visibility', entry);
        });
        entry.layer.on('change:opacity', () => {
          entry.label?.setOpacity(entry.layer.getOpacity());
          events.emit('opacity', entry);
        });
        ctx.hooks.emit('layer:created', { def: entry.def, layer: entry.layer });
        events.emit('created', entry);
      }
      return entry.layer;
    },
    setVisible(id, value) {
      const entry = entries.get(id);
      if (value || entry.layer) registry.ensure(id).setVisible(value);
    },
    setOpacity(id, value) {
      registry.ensure(id).setOpacity(Math.max(0, Math.min(1, value)));
    },
    on: events.on,
  };
  return registry;
}
