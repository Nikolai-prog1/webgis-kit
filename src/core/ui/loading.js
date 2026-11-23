import { el } from './dom.js';
export function createLoading(root, label) {
  let count = 0;
  const node = el('div', {
    class: 'wg-loading',
    text: label,
    role: 'status',
    hidden: true,
  });
  root.append(node);
  return {
    begin() {
      count++;
      node.hidden = false;
    },
    end() {
      count = Math.max(0, count - 1);
      node.hidden = count === 0;
    },
    count: () => count,
  };
}
