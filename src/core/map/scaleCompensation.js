export function compensatedDpi(resolution, maxScale, minScale, screenDpi = 96) {
  if (!Number.isFinite(resolution) || resolution <= 0) return screenDpi;
  const dpi = maxScale
    ? Math.max(
        15,
        Math.min(screenDpi, (maxScale / (resolution * 39.3701)) * 0.98),
      )
    : screenDpi;
  return minScale && resolution * 39.3701 * dpi < minScale
    ? screenDpi
    : Math.round(dpi * 100) / 100;
}
