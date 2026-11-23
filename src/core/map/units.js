export function distanceLabel(length, locale = 'en') {
  return (
    new Intl.NumberFormat(locale, { maximumFractionDigits: 2 }).format(
      length >= 1000 ? length / 1000 : length,
    ) + (length >= 1000 ? ' km' : ' m')
  );
}
export function areaLabel(area, locale = 'en') {
  const divisor = area >= 1e6 ? 1e6 : area >= 1e4 ? 1e4 : 1;
  return (
    new Intl.NumberFormat(locale, { maximumFractionDigits: 2 }).format(
      area / divisor,
    ) + (divisor === 1e6 ? ' km²' : divisor === 1e4 ? ' ha' : ' m²')
  );
}
