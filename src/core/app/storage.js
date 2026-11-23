export function createStorage(prefix, provider = () => localStorage) {
  return {
    get(key, fallback = null) {
      try {
        const v = provider().getItem(`${prefix}:${key}`);
        return v === null ? fallback : JSON.parse(v);
      } catch {
        return fallback;
      }
    },
    set(key, value) {
      try {
        provider().setItem(`${prefix}:${key}`, JSON.stringify(value));
      } catch {
        /* Storage can be denied or full. */
      }
    },
    remove(key) {
      try {
        provider().removeItem(`${prefix}:${key}`);
      } catch {
        /* Storage is optional. */
      }
    },
  };
}
