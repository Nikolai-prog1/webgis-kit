import { mapZoom } from '../../map/createMap.js';
import { el } from '../../ui/dom.js';
import { ensureMarkers } from '../marker/index.js';
export default {
  id: 'goto-coordinates',
  kind: 'tool',
  setup(ctx) {
    const markers = ensureMarkers(ctx);
    const input = el('input', {
      type: 'text',
      'aria-label': ctx.t('coordinates.label'),
      placeholder: ctx.t('coordinates.placeholder'),
    });
    const error = el('div', { class: 'wg-form-error', role: 'status' });
    const form = el(
      'form',
      {},
      el('label', { class: 'wg-field' }, ctx.t('coordinates.label'), input),
      el('button', {
        type: 'submit',
        text: ctx.t('coordinates.go'),
        class: 'wg-primary',
      }),
      error,
    );
    form.addEventListener('submit', (event) => {
      event.preventDefault();
      const parsed = ctx.crs.parse(input.value);
      if (!parsed) {
        error.textContent = ctx.t('coordinates.error', {
          systems: ctx.crs
            .list()
            .map((item) => ctx.localized(item.label || item.code))
            .join(', '),
        });
        return;
      }
      error.textContent = '';
      ctx.view.animate({
        center: parsed.coordinate,
        zoom: Math.min(
          ctx.view.getMaxZoom(),
          Math.max(mapZoom(ctx.view, 18), ctx.view.getZoom()),
        ),
        duration: matchMedia('(prefers-reduced-motion: reduce)').matches
          ? 0
          : 350,
      });
      markers.add(parsed.coordinate);
      ctx.ui.toolbar.close();
    });
    ctx.ui.toolbar.registerTool({
      id: 'goto-coordinates',
      icon: 'ti-crosshair',
      exclusive: false,
      popover: form,
    });
  },
};
