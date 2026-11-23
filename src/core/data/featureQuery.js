import { createMemoryAdapter } from './adapters/memory.js';
import { createGeoServerAdapter } from './adapters/geoserverCql.js';
import { createFesAdapter } from './adapters/fes.js';
/** @param {AppContext} ctx */
export function createFeatureQuery(ctx) {
  const memory = createMemoryAdapter((id) => {
    ctx.layers.ensure(id);
    return ctx.layers.get(id);
  });
  const cql = createGeoServerAdapter(
    ctx.services,
    ctx.view.getProjection().getCode(),
  );
  const fes = createFesAdapter(
    ctx.services,
    ctx.view.getProjection().getCode(),
  );
  function adapter(def) {
    return def.source.type === 'geojson' ||
      (def.source.type === 'wfs' && def.source.strategy === 'all')
      ? memory
      : ctx.services.get(def.query?.service || def.source.service).type ===
          'geoserver'
        ? cql
        : fes;
  }
  function definition(id) {
    const entry = ctx.layers.get(id);
    if (!entry) throw new Error(`Unknown layer: ${id}`);
    return entry.def;
  }
  async function validateFields(def, options) {
    const allowed = new Set(Object.keys(def.fields || {}));
    for (const section of ctx.config.sidebar)
      for (const block of section.blocks)
        if (block.layer === def.id) {
          for (const name of block.fields || []) allowed.add(name);
          for (const control of block.controls || []) {
            allowed.add(control.field);
            if (control.multiValue?.filterField)
              allowed.add(control.multiValue.filterField);
          }
        }
    const requested = [
      ...(options.properties || []),
      ...(options.sortBy || []).map((sort) => sort.field),
    ];
    function visit(where) {
      if (!where) return;
      if (where.and || where.or) (where.and || where.or).forEach(visit);
      else requested.push(where.field);
    }
    visit(options.where);
    if (requested.some((name) => !allowed.has(name)))
      for (const field of (await adapter(def).describe(def)).fields)
        allowed.add(field.name);
    for (const name of requested)
      if (!allowed.has(name)) throw new Error(`Unknown query field: ${name}`);
  }
  const query = {
    async features(id, options = {}) {
      const def = definition(id);
      options.signal?.throwIfAborted();
      await validateFields(def, options);
      return adapter(def).features(def, options);
    },
    describe: (id) => {
      const def = definition(id);
      return adapter(def).describe(def);
    },
    async distinct(id, field, options = {}) {
      const limit = options.limit || 2000;
      const result = await query.features(id, {
        properties: [field],
        withGeometry: false,
        limit,
        signal: options.signal,
      });
      const values = new Set();
      for (const feature of result.features)
        for (const value of options.split &&
        typeof feature.get(field) === 'string'
          ? feature
              .get(field)
              .split(options.split)
              .map((value) => value.trim())
              .filter(Boolean)
          : [feature.get(field)])
          values.add(value);
      return {
        values: [...values].sort((a, b) => String(a).localeCompare(String(b))),
        truncated: result.features.length >= limit,
      };
    },
  };
  return query;
}
