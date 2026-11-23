import { el, button } from './dom.js';
/** @param {AppContext} ctx */
export function createPanels(ctx, host, taskbar) {
  const windows = new Map();
  let z = 1;
  function create(options) {
    if (windows.has(options.id)) {
      const panel = windows.get(options.id);
      if (options.content) panel.content.replaceChildren(options.content);
      if (options.title) panel.setTitle(options.title);
      panel.show();
      return panel;
    }
    const content = el('div', { class: 'wg-panel__content' }, options.content);
    const title = el('strong', { text: ctx.localized(options.title) });
    const node = el('section', {
      class: `wg-panel${options.dock === 'bottom' ? ' wg-panel--bottom' : ''}`,
      role: 'dialog',
      'aria-label': ctx.localized(options.title),
      'data-panel': options.id,
    });
    const header = el('div', { class: 'wg-panel__header', tabIndex: 0 });
    const task = button(ctx.localized(options.title), () => panel.show(), {
      hidden: true,
      'aria-label': `${ctx.t('app.restore')}: ${ctx.localized(options.title)}`,
    });
    let position =
      options.persist === false ? null : ctx.storage.get(`panel.${options.id}`);
    if (!position) {
      const width = 370,
        height = 240,
        gap = 12,
        taken = [...windows.values()]
          .filter((panel) => !panel.node.hidden && !panel.dock)
          .map((panel) => panel.position());
      position = { x: 14, y: 14 };
      let found = false;
      for (
        let y = 14;
        y + 220 <= host.clientHeight && !found;
        y += height + gap
      )
        for (let x = 14; x + width <= host.clientWidth; x += width + gap)
          if (
            !taken.some(
              (p) => Math.abs(p.x - x) < width && Math.abs(p.y - y) < 220,
            )
          ) {
            position = { x, y };
            found = true;
            break;
          }
      if (!found)
        position = {
          x: 14 + ((windows.size * 18) % 100),
          y: 14 + ((windows.size * 18) % 100),
        };
    }
    function place(x, y) {
      position = {
        x: Math.max(
          0,
          Math.min(
            x,
            Math.max(
              0,
              host.clientWidth -
                Math.min(node.offsetWidth || 370, host.clientWidth),
            ),
          ),
        ),
        y: Math.max(0, Math.min(y, Math.max(0, host.clientHeight - 60))),
      };
      if (!options.dock) {
        node.style.left = `${position.x}px`;
        node.style.top = `${position.y}px`;
      }
    }
    function save() {
      if (options.persist !== false)
        ctx.storage.set(`panel.${options.id}`, position);
    }
    const panel = {
      node,
      content,
      dock: options.dock,
      position: () => position,
      setTitle(value) {
        const text = ctx.localized(value);
        title.textContent = text;
        node.setAttribute('aria-label', text);
        task.textContent = text;
        task.setAttribute('aria-label', `${ctx.t('app.restore')}: ${text}`);
      },
      show() {
        node.hidden = false;
        task.hidden = true;
        node.style.zIndex = String(++z);
      },
      close() {
        node.hidden = true;
        task.hidden = true;
        options.onClose?.();
      },
      minimize() {
        node.hidden = true;
        task.hidden = false;
      },
      dispose() {
        node.remove();
        task.remove();
        windows.delete(options.id);
      },
    };
    header.append(
      title,
      el(
        'div',
        { class: 'wg-panel__buttons' },
        button('−', () => panel.minimize(), {
          'aria-label': ctx.t('app.minimize'),
        }),
        button('×', () => panel.close(), { 'aria-label': ctx.t('app.close') }),
      ),
    );
    header.addEventListener('pointerdown', (event) => {
      if (event.target instanceof Element && event.target.closest('button'))
        return;
      if (options.dock || matchMedia('(max-width: 720px)').matches) return;
      const start = {
        x: event.clientX - position.x,
        y: event.clientY - position.y,
      };
      header.setPointerCapture(event.pointerId);
      const move = (event) =>
        place(event.clientX - start.x, event.clientY - start.y);
      const up = () => {
        header.removeEventListener('pointermove', move);
        save();
      };
      header.addEventListener('pointermove', move);
      header.addEventListener('pointerup', up, { once: true });
    });
    header.addEventListener('keydown', (event) => {
      const delta = {
        ArrowLeft: [-20, 0],
        ArrowRight: [20, 0],
        ArrowUp: [0, -20],
        ArrowDown: [0, 20],
      }[event.key];
      if (delta && !options.dock) {
        event.preventDefault();
        place(position.x + delta[0], position.y + delta[1]);
        save();
      }
    });
    node.addEventListener('pointerdown', () => {
      node.style.zIndex = String(++z);
    });
    node.append(header, content);
    host.append(node);
    taskbar.append(task);
    windows.set(options.id, panel);
    place(position.x, position.y);
    panel.show();
    return panel;
  }
  return {
    create,
    all: () => [...windows.values()],
    dispose() {
      for (const panel of [...windows.values()]) panel.dispose();
    },
  };
}
