import { el, button } from '../../ui/dom.js';
import { likePattern } from '../../data/cql.js';
import { createResults } from '../../data/queryResults.js';
export default {
  id: 'attribute-search',
  kind: 'block',
  setup(ctx, options, mount) {
    // Unset text follows the layer: its title labels the box and its field
    // labels describe what can be typed, so renaming them relabels the search.
    const def = ctx.layers?.get(options.layer)?.def;
    const label =
      ctx.localized(options.label) ||
      ctx.localized(def?.title) ||
      ctx.t('search.placeholder');
    const hint =
      ctx.localized(options.placeholder) ||
      (options.fields || [])
        .map((field) => ctx.localized(def?.fields?.[field]?.label) || field)
        .join(', ') ||
      ctx.t('search.placeholder');
    const input = el('input', {
      type: 'search',
      placeholder: hint,
      'aria-label': label,
    });
    const form = el(
      'form',
      {},
      el('label', { class: 'wg-field' }, label, input),
    );
    const status = el('div', { class: 'wg-muted', 'aria-live': 'polite' });
    const results = createResults(ctx, options, 'search');
    let controller;
    const cancel = () => {
      controller?.abort();
      controller = null;
      status.textContent = '';
    };
    const clearOff = ctx.hooks.on('map:clear', cancel);
    form.append(
      el(
        'div',
        { class: 'wg-actions' },
        el('button', {
          type: 'submit',
          text: ctx.t('search.button'),
          class: 'wg-primary',
        }),
        button(ctx.t('app.clear'), () => {
          cancel();
          input.value = '';
          results.clear();
        }),
      ),
      status,
    );
    mount.append(form);
    form.addEventListener('submit', async (event) => {
      event.preventDefault();
      controller?.abort();
      const value = input.value.trim();
      if (value.length < (options.minChars ?? 1)) {
        ctx.ui.toast(
          ctx.t('search.minChars', { count: options.minChars ?? 1 }),
          'warning',
        );
        return;
      }
      const requestController = new AbortController();
      controller = requestController;
      ctx.ui.loading.begin();
      try {
        const result = await ctx.query.features(options.layer, {
          where: {
            or: options.fields.map((field) => ({
              field,
              op: 'ilike',
              value: likePattern(value, options.match),
            })),
          },
          limit: options.limit || 25,
          signal: requestController.signal,
        });
        requestController.signal.throwIfAborted();
        if (controller !== requestController) return;
        results.show(result.features, result.total);
        status.textContent = ctx.t('search.results', {
          count: result.total ?? result.features.length,
        });
      } catch (error) {
        if (controller === requestController && error.name !== 'AbortError')
          ctx.ui.toast(
            ctx.t('search.error', { message: error.message }),
            'error',
          );
      } finally {
        ctx.ui.loading.end();
      }
    });
    return {
      dispose() {
        clearOff();
        cancel();
        results.dispose();
      },
    };
  },
};
