import { el } from '../../ui/dom.js';
export default {
  id: 'basemap-switcher',
  kind: 'block',
  setup(ctx, _options, mount) {
    const config = ctx.config.basemaps;
    for (const item of [
      ...(config.allowNone
        ? [{ id: 'none', title: ctx.t('basemap.none') }]
        : []),
      ...config.items,
    ]) {
      const input = el('input', {
        type: 'radio',
        name: 'wg-basemap',
        value: item.id,
        checked: ctx.basemaps.selected() === item.id,
        onChange: () => ctx.basemaps.select(item.id),
      });
      mount.append(
        el(
          'label',
          { class: 'wg-layer-row' },
          input,
          el('span', { text: ctx.localized(item.title) }),
        ),
      );
    }
    if (config.opacityControl) {
      const range = el('input', {
        type: 'range',
        min: 0,
        max: 100,
        step: 5,
        value: String(ctx.basemaps.opacity() * 100),
        'aria-label': ctx.t('layer.opacity'),
        onInput: () => ctx.basemaps.setOpacity(Number(range.value) / 100),
      });
      mount.append(
        el('label', { class: 'wg-field' }, ctx.t('layer.opacity'), range),
      );
    }
  },
};
