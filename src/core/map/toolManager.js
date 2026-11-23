export function createToolManager(hooks) {
  const tools = new Map();
  let active = null;
  const manager = {
    register(tool) {
      tools.set(tool.id, tool);
      return () => tools.delete(tool.id);
    },
    activate(id) {
      const next = tools.get(id);
      if (!next) return;
      if (next.exclusive === false) {
        next.onActivate?.();
        return;
      }
      if (active === id) {
        manager.deactivate();
        return;
      }
      manager.deactivate();
      active = id;
      next.onActivate?.();
      hooks.emit('tool:change', active);
    },
    deactivate() {
      const previous = active;
      active = null;
      if (previous) tools.get(previous)?.onDeactivate?.();
      hooks.emit('tool:change', null);
    },
    active: () => active,
  };
  return manager;
}
