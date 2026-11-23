const trusted = Symbol('trusted markup');
export const escapeHtml = (value) =>
  String(value ?? '').replace(
    /[&<>"']/g,
    (char) =>
      ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[
        char
      ],
  );
export const raw = (value) => ({ [trusted]: true, value: String(value) });
export function html(strings, ...values) {
  return strings.reduce(
    (text, part, i) =>
      text +
      part +
      (i < values.length
        ? values[i]?.[trusted]
          ? values[i].value
          : escapeHtml(values[i])
        : ''),
    '',
  );
}
/** @template {keyof HTMLElementTagNameMap} K
 * @param {K} tag @param {Record<string, any>} [props] @param {...any} children
 * @returns {HTMLElementTagNameMap[K]} */
export function el(tag, props = {}, ...children) {
  const node = document.createElement(tag);
  for (const [key, value] of Object.entries(props)) {
    if (value === undefined || value === null) continue;
    if (key === 'text') node.textContent = String(value);
    else if (key === 'class') node.className = value;
    else if (key.startsWith('on'))
      node.addEventListener(key.slice(2).toLowerCase(), value);
    else if (key === 'style' && typeof value === 'object')
      Object.assign(node.style, value);
    else if (
      key.startsWith('aria-') ||
      key.startsWith('data-') ||
      key === 'role'
    )
      node.setAttribute(key, String(value));
    else if (key in node) node[key] = value;
    else node.setAttribute(key, String(value));
  }
  for (const child of children.flat(Infinity))
    if (child !== undefined && child !== null && child !== false)
      node.append(
        child instanceof Node ? child : document.createTextNode(String(child)),
      );
  return node;
}
export function safeUrl(value, base = document.baseURI) {
  try {
    const url = new URL(value, base);
    return /^https?:$/.test(url.protocol) ? url.href : '';
  } catch {
    return '';
  }
}
export const template = (text, properties) =>
  String(text || '').replace(/\{([^}]+)\}/g, (_, name) =>
    String(properties[name] ?? ''),
  );
export function button(label, onClick, props = {}) {
  return el('button', { type: 'button', text: label, onClick, ...props });
}
