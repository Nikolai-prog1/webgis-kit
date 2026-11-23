import Feature from 'ol/Feature.js';
export function likeRegex(pattern, insensitive = false) {
  let regex = '^';
  const escape = (char) => char.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  for (let i = 0; i < pattern.length; i++) {
    const char = pattern[i];
    if (char === '\\' && i + 1 < pattern.length) regex += escape(pattern[++i]);
    else regex += char === '%' ? '.*' : char === '_' ? '.' : escape(char);
  }
  return new RegExp(`${regex}$`, insensitive ? 'iu' : 'u');
}
export function matches(properties, where) {
  if (!where) return true;
  if (where.and) return where.and.every((part) => matches(properties, part));
  if (where.or)
    return (
      !where.or.length || where.or.some((part) => matches(properties, part))
    );
  const actual = properties[where.field];
  const value = where.value;
  if (where.op === 'isNull') return actual === null || actual === undefined;
  if (where.op === 'in') return value.includes(actual);
  if (where.op === 'eq')
    return actual === value || (actual == null && value == null);
  if (where.op === 'neq')
    return value == null ? actual != null : actual != null && actual !== value;
  if (actual == null) return false;
  if (where.op === 'like' || where.op === 'ilike')
    return likeRegex(String(value), where.op === 'ilike').test(String(actual));
  const num = Number(value);
  if (!Number.isFinite(num)) return true;
  return (
    {
      lt: actual < num,
      lte: actual <= num,
      gt: actual > num,
      gte: actual >= num,
    }[where.op] ?? false
  );
}
export function inferFields(features) {
  const fields = new Map();
  let geometryName = 'geometry';
  for (const feature of features.slice(0, 200)) {
    geometryName = feature.getGeometryName();
    for (const [name, value] of Object.entries(feature.getProperties())) {
      if (name === geometryName || value == null || typeof value === 'object')
        continue;
      const type =
        typeof value === 'number'
          ? 'number'
          : typeof value === 'boolean'
            ? 'boolean'
            : /^\d{4}-\d\d-\d\d(?:T|$)/.test(String(value))
              ? 'date'
              : 'string';
      if (!fields.has(name)) fields.set(name, { name, type });
    }
  }
  return { fields: [...fields.values()], geometryName };
}
export function createMemoryAdapter(getEntry) {
  async function all(def, signal) {
    const entry = getEntry(def.id);
    await entry.ready;
    signal?.throwIfAborted();
    return entry.layer.getSource().getFeatures();
  }
  return {
    async describe(def) {
      return inferFields(await all(def));
    },
    async features(def, options = {}) {
      let features = (await all(def, options.signal)).filter((feature) =>
        matches(feature.getProperties(), options.where),
      );
      const total = features.length;
      if (options.sortBy?.length)
        features.sort((a, b) => {
          for (const sort of options.sortBy) {
            const av = a.get(sort.field),
              bv = b.get(sort.field);
            const emptyA = av === null || av === undefined || av === '',
              emptyB = bv === null || bv === undefined || bv === '';
            if (emptyA !== emptyB) return emptyA ? 1 : -1;
            if (emptyA) continue;
            const compare =
              typeof av === 'number' && typeof bv === 'number'
                ? av - bv
                : String(av).localeCompare(String(bv));
            if (compare) return sort.dir === 'desc' ? -compare : compare;
          }
          return 0;
        });
      features = features.slice(
        options.offset || 0,
        (options.offset || 0) + (options.limit ?? total),
      );
      if (options.properties || options.withGeometry === false)
        features = features.map((feature) => {
          const properties = options.properties
            ? Object.fromEntries(
                options.properties.map((name) => [name, feature.get(name)]),
              )
            : { ...feature.getProperties() };
          delete properties[feature.getGeometryName()];
          const copy = new Feature(properties);
          copy.setId(feature.getId());
          if (options.withGeometry !== false)
            copy.setGeometry(feature.getGeometry()?.clone());
          return copy;
        });
      return { features, total };
    },
  };
}
