import { el } from './dom.js';
export function createToast(root) {
  const host = el('div', {
    class: 'wg-toasts',
    'aria-live': 'polite',
    'aria-atomic': 'false',
  });
  root.append(host);
  const entries = new Map();
  return function toast(message, type = 'info', durationMs = 6000) {
    if (entries.has(message)) return;
    while (entries.size >= 4) {
      const [key, node] = entries.entries().next().value;
      node.remove();
      entries.delete(key);
    }
    const node = el('div', {
      class: `wg-toast wg-toast--${type}`,
      text: message,
      role: type === 'error' ? 'alert' : 'status',
    });
    entries.set(message, node);
    host.append(node);
    setTimeout(() => {
      node.remove();
      entries.delete(message);
    }, durationMs);
  };
}
