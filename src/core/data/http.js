export function ogcException(text) {
  if (!/^\s*</.test(text)) return null;
  const xml = new DOMParser().parseFromString(text, 'text/xml');
  const nodes = [
    ...xml.getElementsByTagNameNS('*', 'ExceptionText'),
    ...xml.getElementsByTagName('ServiceException'),
  ];
  return nodes.length
    ? nodes.map((node) => node.textContent.trim()).join('; ')
    : null;
}
/** @param {string | URL} url @param {RequestInit} [options] */
export async function request(url, options = {}) {
  const signal = options.signal
    ? AbortSignal.any([options.signal, AbortSignal.timeout(30000)])
    : AbortSignal.timeout(30000);
  const response = await fetch(url, { ...options, signal });
  if (!response.ok) {
    const message = await response.text();
    throw new Error(ogcException(message) || `HTTP ${response.status}`);
  }
  return response;
}
export async function requestJSON(url, options = {}) {
  const response = await request(url, options);
  const text = await response.text();
  const exception = ogcException(text);
  if (exception) throw new Error(exception);
  return JSON.parse(text);
}
