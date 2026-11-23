import { test, expect, vi } from 'vitest';
import Feature from 'ol/Feature.js';
import { createResults } from '../../src/core/data/queryResults.js';
import { createHooks } from '../../src/core/app/hooks.js';

function context(formatter) {
  const def = {
    id: 'samples',
    fields: { size: { label: 'Size', format: 'number' } },
    popup: { formatter },
  };
  return {
    locale: 'en',
    localized: (value) => value,
    t: (key) => key,
    hooks: createHooks(),
    map: { addLayer: vi.fn(), removeLayer: vi.fn() },
    view: { getCenter: () => [0, 0] },
    layers: { get: () => ({ def }) },
    clicks: { register: () => () => {} },
    ui: {
      panels: { create: vi.fn(() => ({ close() {}, dispose() {} })) },
      toast: vi.fn(),
      popup: {
        formatters: new Map(formatter ? [[formatter, () => ({})]] : []),
        close: vi.fn(),
        show: vi.fn(),
        showFeature: vi.fn(),
      },
    },
  };
}
const options = {
  layer: 'samples',
  zoomTo: false,
  groupBy: { field: 'category' },
  result: { title: '{name}', fields: ['size'] },
};
const rows = () => [
  new Feature({ category: 'one', name: 'Alpha', size: 1200 }),
  new Feature({ category: 'one', name: 'Beta', size: 2400 }),
];

test('a grouped result honors the registered formatter and retains every row', () => {
  const ctx = context('groupCard');
  const result = createResults(ctx, options, 'filter');
  result.show(rows());
  expect(ctx.ui.popup.show).not.toHaveBeenCalled();
  const [, feature, coordinate] = ctx.ui.popup.showFeature.mock.calls[0];
  expect(feature.get('_wgRows').map((row) => row.get('name'))).toEqual([
    'Alpha',
    'Beta',
  ]);
  expect(feature.get('_wgCount')).toBe(2);
  expect(coordinate).toEqual([0, 0]);
  result.dispose();
});

test('a grouped result without a formatter includes the configured detail fields', () => {
  const ctx = context();
  const result = createResults(ctx, options, 'filter');
  result.show(rows());
  expect(ctx.ui.popup.show.mock.calls[0][0].rows).toEqual([
    ['1', 'Alpha · Size: 1,200'],
    ['2', 'Beta · Size: 2,400'],
  ]);
  result.dispose();
});

test('closing a search result window also removes its map highlights and popup', () => {
  const ctx = context();
  const result = createResults(
    ctx,
    { ...options, groupBy: undefined },
    'search',
  );
  result.show(rows());
  const source = ctx.map.addLayer.mock.calls[0][0].getSource();
  expect(source.getFeatures()).toHaveLength(2);
  ctx.ui.popup.close.mockClear();
  ctx.ui.panels.create.mock.calls[0][0].onClose();
  expect(source.getFeatures()).toEqual([]);
  expect(ctx.ui.popup.close).toHaveBeenCalledOnce();
  result.dispose();
});
