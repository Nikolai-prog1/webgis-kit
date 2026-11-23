import { el, button } from '../../ui/dom.js';
import { likePattern } from '../../data/cql.js';
import { createResults } from '../../data/queryResults.js';
export default {
  id: 'attribute-search',
  kind: 'block',
  setup(ctx, options, mount) {
    const input = el('input', {
      type: 'search',
      placeholder:
        ctx.localized(options.placeholder) || ctx.t('search.placeholder'),
      'aria-label': ctx.localized(options.label) || ctx.t('search.placeholder'),
    });
    const form = el(
      'form',
      {},
      el(
        'label',
        { class: 'wg-field' },
        ctx.localized(options.label) || ctx.t('search.placeholder'),
        input,
      ),
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
