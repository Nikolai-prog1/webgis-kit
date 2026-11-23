import { test, expect, vi } from 'vitest';
import Feature from 'ol/Feature.js';
import search from '../../src/core/modules/attribute-search/index.js';
import filter from '../../src/core/modules/attribute-filter/index.js';
import { createHooks } from '../../src/core/app/hooks.js';

function setup(module, query) {
  const mount = document.createElement('div');
  const ctx = {
    locale: 'en',
    localized: (value) => value,
    t: (key) => key,
    hooks: createHooks(),
    map: { addLayer: vi.fn(), removeLayer: vi.fn() },
    view: { getCenter: () => [0, 0] },
    layers: { get: () => ({ def: { id: 'samples' } }) },
    clicks: { register: () => () => {} },
    query: { features: vi.fn(query) },
    ui: {
      loading: { begin: vi.fn(), end: vi.fn() },
      toast: vi.fn(),
      popup: {
        formatters: new Map(),
        close: vi.fn(),
        showFeature: vi.fn(),
      },
    },
  };
  const disposable = module.setup(
    ctx,
    {
      layer: 'samples',
      fields: ['name'],
      controls: [{ type: 'text', field: 'name' }],
      zoomTo: false,
    },
    mount,
  );
  mount.querySelector('input').value = 'sample';
  return {
    ctx,
    mount,
    disposable,
    submit: () =>
      mount.querySelector('form').dispatchEvent(new Event('submit')),
  };
}

for (const module of [search, filter]) {
  test.each(['local', 'map'])(
    `${module.id} %s clear cancels pending results even if the adapter ignores abort`,
    async (kind) => {
      let resolve;
      const fixture = setup(
        module,
        () => new Promise((done) => (resolve = done)),
      );
      const { ctx, mount, disposable } = fixture;
      fixture.submit();
      const signal = ctx.query.features.mock.calls[0][1].signal;
      if (kind === 'map') ctx.hooks.emit('map:clear', {});
      else mount.querySelector('button[type="button"]').click();
      const aborted = signal.aborted;
      resolve({ features: [new Feature({ name: 'Late result' })], total: 1 });
      await vi.waitFor(() => expect(ctx.ui.loading.end).toHaveBeenCalled());
      expect(aborted).toBe(true);
      expect(ctx.ui.popup.showFeature).not.toHaveBeenCalled();
      expect(
        ctx.map.addLayer.mock.calls[0][0].getSource().getFeatures(),
      ).toEqual([]);
      expect(mount.querySelector('[aria-live]').textContent).toBe('');
      expect(ctx.ui.toast).not.toHaveBeenCalled();
      disposable.dispose();
    },
  );

  test(`${module.id} map clear removes the result count and retains entered criteria`, async () => {
    const { ctx, mount, disposable, submit } = setup(module, async () => ({
      features: [new Feature({ name: 'Sample' })],
      total: 1,
    }));
    submit();
    await vi.waitFor(() => expect(ctx.ui.loading.end).toHaveBeenCalled());
    expect(mount.querySelector('[aria-live]').textContent).toBe(
      'search.results',
    );
    ctx.hooks.emit('map:clear', {});
    expect(mount.querySelector('[aria-live]').textContent).toBe('');
    expect(mount.querySelector('input').value).toBe('sample');
    expect(ctx.map.addLayer.mock.calls[0][0].getSource().getFeatures()).toEqual(
      [],
    );
    disposable.dispose();
  });
}
