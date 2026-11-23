export function resolveUrl(value, base = document.baseURI) {
  return new URL(value, base).href
    .replaceAll('%7B', '{')
    .replaceAll('%7D', '}');
}
