import { describe, test, expect } from 'vitest';
import { normalize } from '../../src/core/config/normalize.js';
import { validateLite } from '../../src/core/config/validateLite.js';
import { localized, createI18n } from '../../src/core/i18n/index.js';
import { html, raw, safeUrl } from '../../src/core/ui/dom.js';
import { createStorage } from '../../src/core/app/storage.js';
import { createHooks } from '../../src/core/app/hooks.js';
import { validateObject } from '../../tools/validate-config.mjs';
import en from '../../src/core/i18n/locales/en.json';
import bg from '../../src/core/i18n/locales/bg.json';
const minimal = () => ({
  version: 1,
  app: { id: 'test', title: 'Test' },
  map: { center: [0, 0], zoom: 2 },
});
describe('configuration contract', () => {
  test('minimal configuration gains independent defaults', () => {
    const a = normalize(minimal());
    a.basemaps.items.push({ id: 'a' });
    expect(normalize(minimal()).basemaps.items).toEqual([]);
    expect(validateLite(normalize(minimal()))).toEqual([]);
  });
  test('catalog defaults merge and query is derived', () => {
    const config = normalize(
      {
        ...minimal(),
        services: { main: { type: 'geoserver', url: 'geoserver' } },
        catalogs: [{ id: 'themes', title: 'Themes', src: 'themes.json' }],
      },
      {
        themes: {
          defaults: { service: 'main' },
          groups: [
            {
              id: 'points',
              title: 'Points',
              layers: [
                { id: 'towns', title: 'Towns', source: { layers: 'towns' } },
              ],
            },
          ],
        },
      },
    );
    expect(config.catalogs[0].groups[0].layers[0].query).toEqual({
      service: 'main',
      typeName: 'towns',
    });
    expect(validateLite(config)).toEqual([]);
  });
  test('unknown layer and default basemap are actionable errors', () => {
    const config = normalize({
      ...minimal(),
      basemaps: { default: 'missing' },
      sidebar: [
        { id: 'one', blocks: [{ type: 'layer-list', layers: ['missing'] }] },
      ],
    });
    expect(validateLite(config).join(' ')).toContain('unknown layer: missing');
    expect(validateLite(config).join(' ')).toContain('unknown base map');
  });
  test('schema rejects bad sources and unknown root keys', () => {
    expect(
      validateObject({ ...minimal(), surprise: 1 }).length,
    ).toBeGreaterThan(0);
    expect(
      validateObject({
        ...minimal(),
        layers: [{ id: 'bad', title: 'Bad', source: { type: 'geojson' } }],
      }).join(' '),
    ).toContain('url');
  });
  test('schema catches misspelled styles and unknown filter controls', () => {
    expect(
      validateObject({
        ...minimal(),
        layers: [
          {
            id: 'bad',
            title: 'Bad',
            source: { type: 'geojson', url: 'data/a.geojson' },
            style: { strokeWitdh: 3 },
          },
        ],
      }).length,
    ).toBeGreaterThan(0);
    expect(
      validateObject(
        {
          type: 'attribute-filter',
          layer: 'cities',
          controls: [{ type: 'unknown', field: 'name' }],
        },
        'block',
      ).length,
    ).toBeGreaterThan(0);
  });
  test('projected coordinate entry needs a bound', () => {
    const config = normalize({
      ...minimal(),
      toolbar: ['goto-coordinates'],
      crs: [{ code: 'CUSTOM:1', kind: 'projected' }],
    });
    expect(validateLite(config).join(' ')).toContain('bbox');
  });
});
describe('localization and safe DOM helpers', () => {
  test('locale fallbacks preserve first available string', () => {
    expect(localized({ bg: 'Български', en: 'English' }, 'bg')).toBe(
      'Български',
    );
    expect(localized({ en: 'English' }, 'de')).toBe('English');
    expect(localized({ fr: 'Texte' }, 'de')).toBe('Texte');
  });
  test('dictionaries have identical keys and plural interpolation works', () => {
    expect(Object.keys(bg).sort()).toEqual(Object.keys(en).sort());
    expect(createI18n('en').t('items', { count: 2 })).toBe('2 items');
    expect(createI18n('bg').t('search.results', { count: 3 })).toBe(
      'Намерени: 3',
    );
  });
  test('all interpolations are escaped unless explicitly trusted', () => {
    expect(html`<p>${'<img src=x onerror=alert(1)>'}</p>`).toBe(
      '<p>&lt;img src=x onerror=alert(1)&gt;</p>',
    );
    expect(html`${'"\'&'}${raw('<b>safe</b>')}`).toBe(
      '&quot;&#39;&amp;<b>safe</b>',
    );
    expect(safeUrl('javascript:alert(1)')).toBe('');
  });
});
test('storage denial does not prevent startup', () => {
  const storage = createStorage('test', () => {
    throw new Error('denied');
  });
  expect(storage.get('locale', 'en')).toBe('en');
  expect(() => storage.set('x', 1)).not.toThrow();
});
test('hooks await async startup and unregister cleanly', async () => {
  const hooks = createHooks();
  const calls = [];
  const off = hooks.on('ready', async () => {
    calls.push(1);
    return 'done';
  });
  expect(await hooks.emitAsync('ready', {})).toBe('done');
  off();
  await hooks.emitAsync('ready', {});
  expect(calls).toEqual([1]);
});
