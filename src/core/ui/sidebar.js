import { el, button } from './dom.js';
import { icon } from './icons.js';
/** @param {AppContext} ctx */
export function createSidebar(ctx, host) {
  const factories = new Map();
  const disposables = [];
  return {
    registerBlock(type, factory) {
      factories.set(type, factory);
    },
    render() {
      for (const section of ctx.config.sidebar) {
        const content = el('div', {
          class: 'wg-section__body',
          id: `wg-section-${section.id}`,
          hidden: !section.open,
        });
        const toggle = button(
          '',
          () => {
            content.hidden = !content.hidden;
            toggle.setAttribute('aria-expanded', String(!content.hidden));
          },
          {
            class: 'wg-section__toggle',
            'aria-expanded': String(!!section.open),
            'aria-controls': content.id,
          },
        );
        toggle.append(
          icon(section.icon),
          el('span', { text: ctx.localized(section.title) }),
          icon('ti-chevron-down'),
        );
        host.append(el('section', { class: 'wg-section' }, toggle, content));
        for (const block of section.blocks) {
          const mount = el('div', {
            class: `wg-block wg-block--${block.type}`,
          });
          content.append(mount);
          const factory = factories.get(block.type);
          if (!factory) throw new Error(`Unknown sidebar block: ${block.type}`);
          const disposable = factory(ctx, block, mount);
          if (disposable) disposables.push(disposable);
        }
      }
    },
    dispose() {
      disposables.forEach((item) => item.dispose?.());
    },
  };
}
