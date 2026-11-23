import { button, el } from './dom.js';
import { icon } from './icons.js';
import { createPopover } from './toolPopover.js';
/** @param {AppContext} ctx */
export function createToolbar(ctx, host) {
  const buttons = new Map(),
    popovers = new Map(),
    unregister = [];
  const close = () => popovers.forEach((popover) => popover.close());
  const off = ctx.hooks.on('tool:change', (id) => {
    for (const [key, node] of buttons)
      node.setAttribute('aria-pressed', String(id === key));
    if (id) close();
  });
  return {
    registerTool(tool) {
      const label = ctx.localized(tool.label) || ctx.t(`tool.${tool.id}`);
      const node = button('', () => ctx.tools.activate(tool.id), {
        'aria-label': label,
        title: label,
        'aria-pressed': 'false',
        'data-tool': tool.id,
      });
      node.append(icon(tool.icon), el('span', { text: label }));
      host.append(node);
      buttons.set(tool.id, node);
      if (tool.popover) {
        node.setAttribute('aria-haspopup', 'dialog');
        node.setAttribute('aria-expanded', 'false');
        const popover = createPopover(
          node,
          label,
          typeof tool.popover === 'function' ? tool.popover() : tool.popover,
        );
        popovers.set(tool.id, popover);
        unregister.push(
          ctx.tools.register({
            ...tool,
            exclusive: false,
            onActivate() {
              for (const [id, other] of popovers)
                if (id !== tool.id) other.close();
              popover.toggle();
              tool.onActivate?.();
            },
          }),
        );
      } else unregister.push(ctx.tools.register(tool));
    },
    close,
    dispose() {
      off();
      unregister.forEach((fn) => fn());
      popovers.forEach((popover) => popover.dispose());
      host.replaceChildren();
    },
  };
}
