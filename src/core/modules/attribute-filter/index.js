import { el, button } from '../../ui/dom.js';
import { likePattern, escapeLike } from '../../data/cql.js';
import { createResults } from '../../data/queryResults.js';
export default {
  id: 'attribute-filter',
  kind: 'block',
  setup(ctx, options, mount) {
    const form = el('form');
    const controls = [];
    const results = createResults(ctx, options, 'filter');
    let controller;
    if (options.note)
      form.append(
        el('p', { class: 'wg-muted', text: ctx.localized(options.note) }),
      );
    for (const control of options.controls) {
      const label = el(
        'label',
        { class: 'wg-field' },
        ctx.localized(control.label) || control.field,
      );
      const record = { control, inputs: [] };
      if (control.type === 'range') {
        const row = el('div', { class: 'wg-row' });
        for (const bound of ['from', 'to']) {
          const input = el('input', {
            type: 'text',
            inputMode: 'decimal',
            placeholder: ctx.t(`filter.${bound}`),
            'aria-label': `${ctx.localized(control.label) || control.field}: ${ctx.t(`filter.${bound}`)}`,
          });
          row.append(input);
          record.inputs.push(input);
        }
        label.append(row);
      } else if (control.type === 'select') {
        const select = el(
          'select',
          { 'aria-label': ctx.localized(control.label) || control.field },
          el('option', { value: '', text: ctx.t('filter.all') }),
        );
        if (control.nullLabel)
          select.append(
            el('option', {
              value: 'null',
              text: ctx.localized(control.nullLabel),
            }),
          );
        const add = (values) => {
          for (const item of values.filter((item) => item != null)) {
            const value = typeof item === 'object' ? item.value : item;
            select.append(
              el('option', {
                value: JSON.stringify(value),
                text: ctx.localized(
                  typeof item === 'object' ? item.label : item,
                ),
              }),
            );
          }
        };
        if (control.values === 'auto' || !control.values)
          ctx.query
            .distinct(options.layer, control.field, {
              split: control.multiValue?.separator,
            })
            .then((result) => {
              add(result.values);
              if (result.truncated)
                label.append(
                  el('small', { text: ctx.t('filter.valuesTruncated') }),
                );
            })
            .catch((error) =>
              ctx.ui.toast(
                ctx.t('search.error', { message: error.message }),
                'error',
              ),
            );
        else add(control.values);
        label.append(select);
        record.inputs.push(select);
      } else {
        const input = el('input', {
          type: 'text',
          'aria-label': ctx.localized(control.label) || control.field,
        });
        label.append(input);
        record.inputs.push(input);
      }
      controls.push(record);
      form.append(label);
    }
    const status = el('div', { class: 'wg-muted', 'aria-live': 'polite' });
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
          text: ctx.t('filter.apply'),
          class: 'wg-primary',
        }),
        button(ctx.t('app.clear'), () => {
          cancel();
          form.reset();
          results.clear();
        }),
      ),
      status,
    );
    mount.append(form);
    form.addEventListener('submit', async (event) => {
      event.preventDefault();
      const conditions = [];
      for (const { control, inputs } of controls) {
        if (control.type === 'range') {
          for (const [index, input] of inputs.entries())
            if (input.value.trim()) {
              const value = Number(input.value.replace(',', '.'));
              if (!Number.isFinite(value)) {
                ctx.ui.toast(ctx.t('filter.invalidNumber'), 'warning');
                return;
              }
              conditions.push({
                field: control.field,
                op: index ? 'lte' : 'gte',
                value,
              });
            }
        } else if (control.type === 'select' && inputs[0].value !== '') {
          const value = JSON.parse(inputs[0].value);
          if (value === null)
            conditions.push({ field: control.field, op: 'isNull' });
          else if (control.multiValue) {
            const multi = control.multiValue;
            conditions.push({
              field: multi.filterField || control.field,
              op: 'like',
              value: `%${escapeLike(multi.wrap || '|')}${escapeLike(value)}${escapeLike(multi.wrap || '|')}%`,
            });
          } else conditions.push({ field: control.field, op: 'eq', value });
        } else if (control.type === 'text' && inputs[0].value.trim())
          conditions.push({
            field: control.field,
            op: 'ilike',
            value: likePattern(inputs[0].value.trim(), control.match),
          });
      }
      controller?.abort();
      const requestController = new AbortController();
      controller = requestController;
      ctx.ui.loading.begin();
      try {
        const limit = options.limit || 500;
        const result = await ctx.query.features(options.layer, {
          where: { and: conditions },
          limit,
          signal: requestController.signal,
        });
        requestController.signal.throwIfAborted();
        if (controller !== requestController) return;
        results.show(result.features, result.total);
        status.textContent =
          result.features.length >= limit &&
          (result.total === null || result.total > limit)
            ? ctx.t('filter.truncated', { limit })
            : ctx.t('search.results', {
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
