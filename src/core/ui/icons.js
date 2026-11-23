import { el } from './dom.js';
export function icon(name) {
  return el('i', {
    class: /^ti-[a-z0-9-]+$/.test(name || '') ? `ti ${name}` : 'ti ti-map',
    'aria-hidden': 'true',
  });
}
