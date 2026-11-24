import { test, expect, vi } from 'vitest';
import search from '../../src/core/modules/attribute-search/index.js';
import { createHooks } from '../../src/core/app/hooks.js';

test('an unlabelled search shows the layer title and its field labels', () => {
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
          title: { en: 'Huts and peaks' },
          fields: { name: { label: 'Name' }, code: { label: { en: 'Code' } } },
        },
      }),
    },
    clicks: { register: () => () => {} },
    query: { features: vi.fn() },
    ui: {
      loading: { begin: vi.fn(), end: vi.fn() },
      toast: vi.fn(),
      popup: { formatters: new Map(), close: vi.fn(), showFeature: vi.fn() },
    },
  };
  const disposable = search.setup(
    ctx,
    { layer: 'huts', fields: ['name', 'code'] },
    mount,
  );
  const input = mount.querySelector('input');
  expect(input.getAttribute('aria-label')).toBe('Huts and peaks');
  expect(input.placeholder).toBe('Name, Code');
  disposable.dispose();
});
