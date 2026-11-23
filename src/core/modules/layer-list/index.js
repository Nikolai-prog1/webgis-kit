import { el, button } from '../../ui/dom.js';
export default {
  id: 'layer-list',
  kind: 'block',
  setup(ctx, options, mount) {
    const inputs = new Map();
    for (const id of options.layers) {
      const entry = ctx.layers.get(id);
      const def = entry.def;
      const input = el('input', {
        type: 'checkbox',
        checked: !!entry.layer?.getVisible(),
        onChange: () => ctx.layers.setVisible(id, input.checked),
      });
      inputs.set(id, input);
      const row = el(
        'div',
        { class: 'wg-layer-row' },
        el('label', {}, input, el('span', { text: ctx.localized(def.title) })),
      );
      if (def.table)
        row.append(
          button('▤', () => ctx.ui.openTable?.(id), {
            'aria-label': `${ctx.t('layer.table')}: ${ctx.localized(def.title)}`,
            class: 'wg-icon-button',
          }),
        );
      mount.append(row);
    }
    const off = ctx.layers.on('visibility', (entry) => {
      if (inputs.has(entry.def.id))
        inputs.get(entry.def.id).checked = entry.layer.getVisible();
    });
    return { dispose: off };
  },
};
