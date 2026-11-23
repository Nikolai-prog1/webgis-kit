export const fieldName = (name) =>
  /^[A-Za-z_][A-Za-z0-9_]*$/.test(name)
    ? name
    : `"${String(name).replaceAll('"', '""')}"`;
export const literal = (value) =>
  typeof value === 'number' && Number.isFinite(value)
    ? String(value)
    : typeof value === 'boolean'
      ? String(value).toUpperCase()
      : `'${String(value).replaceAll("'", "''")}'`;
export const escapeLike = (value) =>
  String(value).replace(/[\\%_]/g, (char) => `\\${char}`);
export function likePattern(value, match = 'contains') {
  const escaped = escapeLike(value);
  return match === 'equals'
    ? escaped
    : match === 'startsWith'
      ? `${escaped}%`
      : `%${escaped}%`;
}
export function toCql(where) {
  if (!where) return '';
  for (const join of ['and', 'or'])
    if (where[join]) {
      const parts = where[join].map(toCql).filter(Boolean);
      return parts.length ? `(${parts.join(` ${join.toUpperCase()} `)})` : '';
    }
  const field = fieldName(where.field);
  const op = where.op;
  const value = where.value;
  if (op === 'isNull') return `${field} IS NULL`;
  if (op === 'in') {
    const values = value.filter((item) => item != null);
    const parts = [
      ...(values.length
        ? [`${field} IN (${values.map(literal).join(',')})`]
        : []),
      ...(value.some((item) => item == null) ? [`${field} IS NULL`] : []),
    ];
    return parts.length > 1 ? `(${parts.join(' OR ')})` : parts[0] || 'EXCLUDE';
  }
  if (
    ['lt', 'lte', 'gt', 'gte'].includes(op) &&
    !Number.isFinite(Number(value))
  )
    return '';
  const operator = {
    eq: '=',
    neq: '<>',
    lt: '<',
    lte: '<=',
    gt: '>',
    gte: '>=',
    like: 'LIKE',
    ilike: 'ILIKE',
  }[op];
  if (!operator) throw new Error(`Unsupported condition: ${op}`);
  if (value === null && ['eq', 'neq'].includes(op))
    return `${field} IS ${op === 'neq' ? 'NOT ' : ''}NULL`;
  return `${field} ${operator} ${literal(['lt', 'lte', 'gt', 'gte'].includes(op) ? Number(value) : value)}`;
}
