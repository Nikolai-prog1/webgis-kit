export function createHooks() {
  const listeners = new Map();
  return {
    on(name, fn) {
      if (!listeners.has(name)) listeners.set(name, new Set());
      listeners.get(name).add(fn);
      return () => listeners.get(name)?.delete(fn);
    },
    emit(name, payload) {
      let result;
      for (const fn of listeners.get(name) || []) {
        const value = fn(payload);
        if (value !== undefined) result = value;
      }
      return result;
    },
    async emitAsync(name, payload) {
      let result;
      for (const fn of listeners.get(name) || []) {
        const value = await fn(payload);
        if (value !== undefined) result = value;
      }
      return result;
    },
    clear() {
      listeners.clear();
    },
  };
}
