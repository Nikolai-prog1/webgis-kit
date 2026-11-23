import { el, button } from '../../ui/dom.js';
import {
  legendEntries,
  legendSymbol,
  legendGraphic,
} from '../../ui/legendSymbols.js';
import {
  loadCapabilities,
  capabilitiesToCatalog,
} from '../../data/wmsCapabilities.js';
import { normalize } from '../../config/normalize.js';
import { transformExtent } from 'ol/proj.js';
import { unByKey } from 'ol/Observable.js';
export default {
  id: 'catalog-launcher',
  kind: 'block',
  setup(ctx, options, mount) {
    let catalog = ctx.config.catalogs.find((cat) => cat.id === options.catalog);
    let selected = new Set(
      catalog.groups.flatMap((group) =>
        group.layers.filter((def) => def.visible).map((def) => def.id),
      ),
    );
    let master = selected.size > 0,
      loaded = catalog.type !== 'wms-capabilities',
      panel,
      syncing = false;
    const inputs = new Map(),
      groupHeaders = [];
    const catalogView = el('div'),
      activeView = el('div', { hidden: true }),
      active = el('div');
    activeView.append(active);
    const activeButton = button(
      '',
      () => {
        catalogView.hidden = true;
        activeView.hidden = false;
        catalogButton.setAttribute('aria-selected', 'false');
        activeButton.setAttribute('aria-selected', 'true');
      },
      { role: 'tab', 'aria-selected': 'false' },
    );
    const catalogButton = button(
      ctx.t('catalog.catalog'),
      () => {
        catalogView.hidden = false;
        activeView.hidden = true;
        catalogButton.setAttribute('aria-selected', 'true');
        activeButton.setAttribute('aria-selected', 'false');
      },
      { role: 'tab', 'aria-selected': 'true' },
    );
    const content = el(
      'div',
      {},
      el(
        'div',
        { class: 'wg-catalog-tabs', role: 'tablist' },
        catalogButton,
        activeButton,
      ),
      catalogView,
      activeView,
    );
    const masterInput = el('input', {
      type: 'checkbox',
      checked: master,
      onChange: async () => {
        master = masterInput.checked;
        if (master) await open();
        apply();
      },
    });
    const errorHost = el('div', { class: 'wg-muted', 'aria-live': 'polite' });
    mount.append(
      el(
        'div',
        { class: 'wg-layer-row' },
        el(
          'label',
          {},
          masterInput,
          el('span', { text: ctx.localized(options.label || catalog.title) }),
        ),
        button('↗', () => void open(), {
          'aria-label': ctx.t('catalog.open', {
            title: ctx.localized(catalog.title),
          }),
          class: 'wg-icon-button',
        }),
      ),
      errorHost,
    );
    function update() {
      masterInput.checked = master;
      activeButton.textContent = `${ctx.t('catalog.active')} (${selected.size})`;
      for (const [id, input] of inputs) input.checked = selected.has(id);
      for (const item of groupHeaders) {
        const count = item.group.layers.filter((def) =>
          selected.has(def.id),
        ).length;
        if (item.input) {
          item.input.checked = count === item.group.layers.length;
          item.input.indeterminate =
            count > 0 && count < item.group.layers.length;
        }
        if (item.none) item.none.checked = count === 0;
      }
      renderActive();
    }
    function apply() {
      syncing = true;
      for (const entry of ctx.layers.byCatalog(catalog.id))
        ctx.layers.setVisible(
          entry.def.id,
          master && selected.has(entry.def.id),
        );
      syncing = false;
      update();
    }
    function choose(group, id, checked) {
      if (group.exclusive)
        for (const def of group.layers) selected.delete(def.id);
      if (checked) selected.add(id);
      else selected.delete(id);
      apply();
    }
    function renderActive() {
      active.replaceChildren();
      if (!selected.size)
        active.append(
          el('p', { class: 'wg-muted', text: ctx.t('catalog.empty') }),
        );
      const scale = ctx.view.getResolution() / 0.00028;
      for (const id of selected) {
        const entry = ctx.layers.get(id),
          def = entry.def;
        const out = !!(
          (def.minScale && scale < def.minScale) ||
          (def.maxScale && scale > def.maxScale)
        );
        const card = el(
          'div',
          { class: `wg-active-layer${out ? ' wg-active-layer--outside' : ''}` },
          el(
            'div',
            { class: 'wg-row' },
            el('strong', { text: ctx.localized(def.title) }),
            button(
              '×',
              () => {
                selected.delete(id);
                apply();
              },
              {
                'aria-label': `${ctx.t('app.remove')}: ${ctx.localized(def.title)}`,
              },
            ),
          ),
        );
        const range = el('input', {
          type: 'range',
          min: 10,
          max: 100,
          step: 5,
          value: String((entry.layer?.getOpacity() ?? def.opacity ?? 1) * 100),
          'aria-label': `${ctx.t('layer.opacity')}: ${ctx.localized(def.title)}`,
          'data-layer': id,
          onInput: () => {
            ctx.layers.setOpacity(id, Number(range.value) / 100);
            if (!master) {
              syncing = true;
              ctx.layers.setVisible(id, false);
              syncing = false;
            }
          },
        });
        card.append(
          el('label', { class: 'wg-field' }, ctx.t('layer.opacity'), range),
        );
        if (def.extent)
          card.append(
            button(ctx.t('layer.extent'), () =>
              ctx.view.fit(
                transformExtent(
                  def.extent,
                  'EPSG:4326',
                  ctx.view.getProjection(),
                ),
                { padding: [35, 35, 35, 35], maxZoom: 17 },
              ),
            ),
          );
        if (out)
          card.append(
            el('small', {
              text: ctx.t('layer.scale', {
                min: Math.round(def.minScale || 0).toLocaleString(ctx.locale),
                max: def.maxScale
                  ? Math.round(def.maxScale).toLocaleString(ctx.locale)
                  : '∞',
              }),
            }),
          );
        if (def.legend === 'auto') card.append(legendGraphic(ctx, def));
        else if (legendEntries(def).length > 1)
          for (const item of legendEntries(def))
            card.append(
              el(
                'div',
                { class: 'wg-row' },
                legendSymbol(item),
                el('span', { text: ctx.localized(item.label) }),
              ),
            );
        active.append(card);
      }
    }
    function build() {
      catalogView.replaceChildren();
      inputs.clear();
      groupHeaders.length = 0;
      const search = el('input', {
        type: 'search',
        placeholder: ctx.t('catalog.search'),
        'aria-label': ctx.t('catalog.search'),
        class: 'wg-catalog-search',
      });
      catalogView.append(search);
      const rows = [];
      for (const group of catalog.groups) {
        const host = el('section', { class: 'wg-catalog-group' }),
          header = el('div', { class: 'wg-row' }),
          record = { group, input: null, none: null };
        if (group.selectAll && !group.exclusive) {
          record.input = el('input', {
            type: 'checkbox',
            'aria-label': `${ctx.t('catalog.all')}: ${ctx.localized(group.title)}`,
            onChange: () => {
              for (const def of group.layers)
                if (record.input.checked) selected.add(def.id);
                else selected.delete(def.id);
              apply();
            },
          });
          header.append(record.input);
        }
        header.append(
          el('strong', {
            text: `${ctx.localized(group.title)} (${group.layers.length})`,
          }),
        );
        host.append(header);
        if (group.hint)
          host.append(
            el('p', { class: 'wg-muted', text: ctx.localized(group.hint) }),
          );
        if (group.exclusive) {
          record.none = el('input', {
            type: 'radio',
            name: `${catalog.id}-${group.id}`,
            onChange: () => {
              for (const def of group.layers) selected.delete(def.id);
              apply();
            },
          });
          host.append(
            el(
              'label',
              { class: 'wg-layer-row' },
              record.none,
              ctx.t('catalog.none'),
            ),
          );
        }
        for (const def of group.layers) {
          const input = el('input', {
            type: group.exclusive ? 'radio' : 'checkbox',
            name: `${catalog.id}-${group.id}`,
            onChange: () => choose(group, def.id, input.checked),
          });
          inputs.set(def.id, input);
          const label = el(
            'label',
            {},
            input,
            def.legend === 'auto'
              ? legendGraphic(ctx, def)
              : legendSymbol(legendEntries(def)[0]),
            el(
              'span',
              {},
              el('span', { text: ctx.localized(def.title) }),
              def.provider
                ? el('small', {
                    class: 'wg-provider',
                    text: ctx.localized(def.provider),
                  })
                : null,
            ),
          );
          const row = el('div', { class: 'wg-layer-row' }, label);
          if (def.note)
            row.append(
              button(
                'ⓘ',
                () =>
                  ctx.ui.panels.create({
                    id: `note-${def.id}`,
                    title: ctx.localized(def.title),
                    content: el('p', { text: ctx.localized(def.note) }),
                    persist: false,
                  }),
                {
                  'aria-label': `${ctx.t('layer.note')}: ${ctx.localized(def.title)}`,
                  class: 'wg-icon-button',
                },
              ),
            );
          if (def.table)
            row.append(
              button('▤', () => ctx.ui.openTable(def.id), {
                'aria-label': `${ctx.t('layer.table')}: ${ctx.localized(def.title)}`,
                class: 'wg-icon-button',
              }),
            );
          host.append(row);
          rows.push({
            row,
            host,
            title: ctx.localized(def.title).toLocaleLowerCase(ctx.locale),
          });
        }
        catalogView.append(host);
        groupHeaders.push(record);
      }
      search.addEventListener('input', () => {
        const value = search.value.toLocaleLowerCase(ctx.locale);
        for (const item of rows) item.row.hidden = !item.title.includes(value);
        for (const host of catalogView.querySelectorAll('section'))
          host.hidden = !rows.some(
            (item) => item.host === host && !item.row.hidden,
          );
      });
      update();
    }
    async function open() {
      try {
        errorHost.replaceChildren();
        if (!loaded) {
          const service = ctx.services.get(catalog.service);
          const tree = await loadCapabilities(
            ctx.services.wmsUrl(catalog.service),
            { version: service.wmsVersion },
          );
          const data = capabilitiesToCatalog(tree, catalog);
          const normalized = normalize(
            { ...ctx.config, catalogs: [catalog] },
            { [catalog.id]: data },
          ).catalogs[0];
          catalog = normalized;
          for (const group of catalog.groups)
            for (const def of group.layers) ctx.layers.add(def);
          loaded = true;
          build();
        }
        if (!panel)
          panel = ctx.ui.panels.create({
            id: `catalog-${catalog.id}`,
            title: ctx.localized(catalog.title),
            content,
          });
        else panel.show();
        update();
      } catch (error) {
        master = false;
        masterInput.checked = false;
        errorHost.append(
          el('span', { text: error.message }),
          button(ctx.t('app.retry'), async () => {
            master = true;
            masterInput.checked = true;
            await open();
            apply();
          }),
        );
      }
    }
    if (loaded) build();
    apply();
    const off = ctx.layers.on('visibility', (entry) => {
      if (syncing || entry.def.catalogId !== catalog.id) return;
      if (entry.layer.getVisible()) {
        selected.add(entry.def.id);
        master = true;
      } else selected.delete(entry.def.id);
      update();
    });
    const scaleKey = ctx.view.on('change:resolution', renderActive);
    return {
      dispose() {
        off();
        unByKey(scaleKey);
        panel?.dispose();
      },
    };
  },
};
