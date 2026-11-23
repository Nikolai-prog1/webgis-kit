import VectorLayer from 'ol/layer/Vector.js';
import VectorSource from 'ol/source/Vector.js';
import { el, button } from '../../ui/dom.js';
import { formatValue } from '../../ui/format.js';
import { download, csvText } from '../../ui/download.js';
import { likePattern } from '../../data/cql.js';
import { vectorStyle } from '../../map/vectorStyle.js';
/** @param {AppContext} ctx */
export function setupAttributeTable(ctx) {
  const source = new VectorSource();
  const highlight = new VectorLayer({
    source,
    zIndex: 5000,
    style: vectorStyle(
      {
        geometry: 'point',
        style: {
          stroke: '#be5433',
          fill: '#f2b898',
          fillOpacity: 0.2,
          radius: 9,
          strokeWidth: 3,
        },
      },
      ctx.view,
    ),
  });
  highlight.set('wg:auxiliary', true);
  ctx.map.addLayer(highlight);
  const opened = new Map();
  const off = ctx.hooks.on('map:clear', () => source.clear());
  ctx.ui.openTable = async (id) => {
    if (opened.has(id)) {
      opened.get(id).show();
      return;
    }
    const def = ctx.layers.get(id).def;
    const content = el('div', { class: 'wg-table' });
    let controller,
      offset = 0,
      sortBy = [],
      searchText = '',
      fields = [];
    const input = el('input', {
      type: 'search',
      'aria-label': ctx.t('table.search'),
      placeholder: ctx.t('table.search'),
    });
    const body = el('tbody');
    const head = el('thead');
    const table = el('table', {}, head, body);
    const count = el('span', { 'aria-live': 'polite' });
    const previous = button(ctx.t('table.previous'), () => {
      void load({ offset: Math.max(0, offset - 100) });
    });
    const next = button(ctx.t('table.next'), () => {
      void load({ offset: offset + 100 });
    });
    const panel = ctx.ui.panels.create({
      id: `table-${id}`,
      title: ctx.localized(def.title),
      content,
      dock: 'bottom',
      onClose: () => source.clear(),
    });
    opened.set(id, panel);
    previous.disabled = next.disabled = true;
    const where = (text = searchText) =>
      text
        ? {
            or: fields
              .filter((field) => field.type === 'string')
              .map((field) => ({
                field: field.name,
                op: 'ilike',
                value: likePattern(text),
              })),
          }
        : undefined;
    async function load(proposed = {}) {
      const pending = { offset, sortBy, searchText, ...proposed };
      controller?.abort();
      const requestController = new AbortController();
      controller = requestController;
      ctx.ui.loading.begin();
      try {
        const result = await ctx.query.features(id, {
          where: where(pending.searchText),
          limit: 100,
          offset: pending.offset,
          sortBy: pending.sortBy,
          signal: requestController.signal,
        });
        requestController.signal.throwIfAborted();
        if (controller !== requestController) return;
        const rows = document.createDocumentFragment();
        for (const feature of result.features) {
          const row = el('tr', { tabIndex: 0 });
          for (const field of fields)
            row.append(
              el('td', {
                text: formatValue(
                  feature.get(field.name),
                  def.fields?.[field.name],
                  ctx.locale,
                  ctx.t,
                ),
              }),
            );
          const select = () => {
            source.clear();
            if (feature.getGeometry()) {
              source.addFeature(feature.clone());
              ctx.view.fit(feature.getGeometry().getExtent(), {
                maxZoom: 14,
                padding: [60, 60, 350, 60],
              });
            } else ctx.ui.toast(ctx.t('app.noGeometry'), 'warning');
          };
          row.addEventListener('click', select);
          row.addEventListener('keydown', (event) => {
            if (event.key === 'Enter') select();
          });
          rows.append(row);
        }
        offset = pending.offset;
        sortBy = pending.sortBy;
        searchText = pending.searchText;
        body.replaceChildren(rows);
        count.textContent = ctx.t('table.count', {
          from: result.features.length ? offset + 1 : 0,
          to: result.features.length ? offset + result.features.length : 0,
          total: result.total ?? '—',
        });
        previous.disabled = offset === 0;
        next.disabled =
          result.features.length < 100 ||
          (result.total !== null && offset + 100 >= result.total);
      } catch (error) {
        if (controller === requestController && error.name !== 'AbortError')
          ctx.ui.toast(
            ctx.t('search.error', { message: error.message }),
            'error',
          );
      } finally {
        ctx.ui.loading.end();
      }
    }
    const csv = button(ctx.t('table.csv'), async () => {
      try {
        const result = await ctx.query.features(id, {
          where: where(),
          limit: 10000,
          sortBy,
          withGeometry: false,
        });
        if (result.total > 10000 || result.features.length === 10000)
          ctx.ui.toast(ctx.t('filter.truncated', { limit: 10000 }), 'warning');
        download(
          new Blob(
            [
              csvText(
                fields.map((field) => ({
                  ...field,
                  label: ctx.localized(
                    def.fields?.[field.name]?.label || field.name,
                  ),
                })),
                result.features,
              ),
            ],
            { type: 'text/csv;charset=utf-8' },
          ),
          `${id}.csv`,
        );
      } catch (error) {
        ctx.ui.toast(
          ctx.t('search.error', { message: error.message }),
          'error',
        );
      }
    });
    content.append(
      el(
        'form',
        {
          class: 'wg-row',
          onSubmit: (event) => {
            event.preventDefault();
            void load({ offset: 0, searchText: input.value });
          },
        },
        input,
        el('button', { type: 'submit', text: ctx.t('search.button') }),
        csv,
      ),
      el('div', { class: 'wg-table__scroll' }, table),
      el('div', { class: 'wg-row' }, previous, count, next),
    );
    try {
      const description = await ctx.query.describe(id);
      fields = description.fields
        .filter((field) => !def.fields?.[field.name]?.hidden)
        .sort(
          (a, b) =>
            (def.fields?.[a.name]?.order ?? 100) -
            (def.fields?.[b.name]?.order ?? 100),
        );
      const header = el('tr');
      for (const field of fields)
        header.append(
          el(
            'th',
            {},
            button(
              ctx.localized(def.fields?.[field.name]?.label || field.name),
              () => {
                const proposedSort = [
                  {
                    field: field.name,
                    dir:
                      sortBy[0]?.field === field.name && sortBy[0].dir === 'asc'
                        ? 'desc'
                        : 'asc',
                  },
                ];
                void load({ offset: 0, sortBy: proposedSort });
              },
              {
                'aria-label': ctx.t('table.sort', {
                  field: ctx.localized(
                    def.fields?.[field.name]?.label || field.name,
                  ),
                }),
              },
            ),
          ),
        );
      head.append(header);
      await load();
    } catch (error) {
      ctx.ui.toast(ctx.t('search.error', { message: error.message }), 'error');
    }
  };
  return {
    dispose() {
      off();
      ctx.map.removeLayer(highlight);
      opened.forEach((panel) => panel.dispose());
    },
  };
}
export default {
  id: 'attribute-table',
  kind: 'global',
  setup: setupAttributeTable,
};
