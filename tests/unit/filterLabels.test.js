import { test, expect, vi } from 'vitest';
import filter from '../../src/core/modules/attribute-filter/index.js';
import { createHooks } from '../../src/core/app/hooks.js';

test('unlabelled filter controls use the layer field label, then the field name', () => {
  const mount = document.createElement('div');
  const ctx = {
    locale: 'en',
    localized: (value) => (typeof value === 'object' ? value?.en : value),
    t: (key) => key,
    hooks: createHooks(),
    map: { addLayer: vi.fn(), removeLayer: vi.fn() },
    layers: {
      get: () => ({
        def: {
          id: 'huts',
          fields: { altitude: { label: { en: 'Altitude (m)' } } },
        },
      }),
    },
    clicks: { register: () => () => {} },
    query: { features: vi.fn(), distinct: vi.fn(async () => []) },
    ui: {
      loading: { begin: vi.fn(), end: vi.fn() },
      toast: vi.fn(),
      popup: { formatters: new Map(), close: vi.fn(), showFeature: vi.fn() },
    },
  };
  const disposable = filter.setup(
    ctx,
    {
      layer: 'huts',
      controls: [
        { type: 'range', field: 'altitude' },
        { type: 'text', field: 'name' },
        { type: 'text', field: 'type', label: 'Kind' },
      ],
    },
    mount,
  );
  const labels = [...mount.querySelectorAll('label.wg-field')].map((label) =>
    label.firstChild.textContent.trim(),
  );
  expect(labels).toEqual(['Altitude (m)', 'name', 'Kind']);
  disposable.dispose();
});
