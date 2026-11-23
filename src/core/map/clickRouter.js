import { unByKey } from 'ol/Observable.js';
export function createClickRouter(map) {
  const handlers = new Map();
  const key = map.on('singleclick', async (event) => {
    for (const handler of [...handlers.values()].sort(
      (a, b) => b.priority - a.priority,
    ))
      if (await handler.handle(event)) break;
  });
  return {
    register(handler) {
      handlers.set(handler.id, handler);
      return () => handlers.delete(handler.id);
    },
    dispose() {
      unByKey(key);
      handlers.clear();
    },
  };
}
