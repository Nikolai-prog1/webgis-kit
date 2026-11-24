import Overlay from 'ol/Overlay.js';
import { el, button, safeUrl, template } from './dom.js';
import { copyText } from './clipboard.js';
import { formatValue } from './format.js';
/** @param {AppContext} ctx */
export function createPopup(ctx, formatters = new Map()) {
  const content = el('div', { class: 'wg-popup__content' });
  const title = el('strong', { class: 'wg-popup__title' });
  const node = el(
    'section',
    { class: 'wg-popup', role: 'dialog', hidden: true },
    el(
      'div',
      { class: 'wg-popup__header' },
      title,
      button('×', () => popup.close(), { 'aria-label': ctx.t('app.close') }),
    ),
    content,
  );
  const overlay = new Overlay({
    element: node,
    positioning: 'bottom-center',
    offset: [0, -15],
    autoPan: {
      animation: {
        duration: matchMedia('(prefers-reduced-motion: reduce)').matches
          ? 0
          : 200,
      },
    },
  });
  ctx.map.addOverlay(overlay);
  const popup = {
    registerFormatter: (name, fn) => formatters.set(name, fn),
    formatters,
    close() {
      node.hidden = true;
      overlay.setPosition(undefined);
    },
    show(options) {
      title.textContent = options.title || '';
      content.replaceChildren();
      if (options.html) content.innerHTML = options.html;
      for (const [label, value] of options.rows || []) {
        const rendered = String(value ?? '—');
        const valueNode =
          /^https?:\/\//i.test(rendered) && safeUrl(rendered)
            ? el('a', {
                text: rendered,
                href: safeUrl(rendered),
                target: '_blank',
                rel: 'noopener noreferrer',
              })
            : el('span', { text: rendered });
        content.append(
          el(
            'div',
            { class: 'wg-popup__row' },
            el('span', { class: 'wg-muted', text: label }),
            valueNode,
            button(
              '⧉',
              () =>
                copyText(rendered).then(() =>
                  ctx.ui.toast(ctx.t('app.copied')),
                ),
              { 'aria-label': ctx.t('app.copy') },
            ),
          ),
        );
      }
      // Visible first: auto-pan measures the popup to keep it inside the map.
      node.hidden = false;
      overlay.setPosition(options.coordinate || ctx.view.getCenter());
    },
    showFeature(def, feature, coordinate) {
      const properties = feature.getProperties();
      const formatter = formatters.get(def.popup?.formatter);
      if (formatter) {
        popup.show({
          coordinate,
          ...formatter({ properties, layer: def, feature }),
        });
        return;
      }
      const keys = (def.popup?.fields || Object.keys(properties)).filter(
        (key) =>
          !['geometry', 'geom', 'the_geom', 'bbox', 'boundedBy'].includes(
            key,
          ) &&
          !def.fields?.[key]?.hidden &&
          properties[key] !== null &&
          properties[key] !== undefined &&
          properties[key] !== '' &&
          typeof properties[key] !== 'object',
      );
      popup.show({
        coordinate,
        title: def.popup?.title
          ? template(ctx.localized(def.popup.title), properties)
          : ctx.localized(def.title),
        rows: keys.map((key) => [
          ctx.localized(def.fields?.[key]?.label || key),
          formatValue(properties[key], def.fields?.[key], ctx.locale, ctx.t),
        ]),
      });
    },
  };
  return popup;
}
