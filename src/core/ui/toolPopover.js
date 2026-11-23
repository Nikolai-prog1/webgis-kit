import { el } from './dom.js';
export function createPopover(anchor, label, content) {
  const node = el(
    'div',
    { class: 'wg-popover', role: 'dialog', 'aria-label': label },
    content,
  );
  document.body.append(node);
  let open = false;
  function place() {
    const box = anchor.getBoundingClientRect();
    node.style.left = `${Math.max(8, Math.min(innerWidth - node.offsetWidth - 8, box.left))}px`;
    node.style.top = `${Math.min(innerHeight - node.offsetHeight - 8, box.bottom + 9)}px`;
  }
  function close() {
    open = false;
    node.hidden = true;
    anchor.setAttribute('aria-expanded', 'false');
  }
  const outside = (event) => {
    if (!node.contains(event.target) && !anchor.contains(event.target)) close();
  };
  const key = (event) => {
    if (event.key === 'Escape' && open) {
      close();
      anchor.focus();
    }
  };
  document.addEventListener('pointerdown', outside);
  document.addEventListener('keydown', key);
  window.addEventListener('resize', place);
  close();
  return {
    toggle() {
      if (open) {
        close();
        return;
      }
      open = true;
      node.hidden = false;
      place();
      anchor.setAttribute('aria-expanded', 'true');
      node.querySelector('input')?.focus();
    },
    close,
    dispose() {
      document.removeEventListener('pointerdown', outside);
      document.removeEventListener('keydown', key);
      window.removeEventListener('resize', place);
      node.remove();
    },
  };
}
