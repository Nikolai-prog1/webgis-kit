export function zIndex(def, index = 0) {
  if (Number.isFinite(def.zIndex)) return def.zIndex;
  if (!def.catalogId) return 1000 + index;
  return (
    (def.exclusive || def.geometry === 'raster'
      ? 100
      : { polygon: 200, line: 300, point: 400 }[def.geometry] || 100) +
    index / 1000
  );
}
