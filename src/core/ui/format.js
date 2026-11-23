/** @param {any} value @param {Record<string, any>} [definition] */
export function formatValue(
  value,
  definition = {},
  locale = 'en',
  t = (key) => key,
) {
  if (value === null || value === undefined || value === '') return '—';
  if (typeof value === 'boolean') return t(value ? 'app.yes' : 'app.no');
  if (definition.format === 'id') return String(value).replace(/\.0$/, '');
  if (definition.format === 'date') {
    const date = new Date(value);
    return Number.isNaN(date.getTime())
      ? String(value)
      : new Intl.DateTimeFormat(locale).format(date);
  }
  if (definition.format === 'number' || typeof value === 'number')
    return new Intl.NumberFormat(locale).format(Number(value));
  return String(value);
}
