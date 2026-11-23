import { test, expect, vi } from 'vitest';
import Feature from 'ol/Feature.js';
import LineString from 'ol/geom/LineString.js';
import Polygon from 'ol/geom/Polygon.js';
import { get } from 'ol/proj.js';
import measure from '../../src/core/modules/measure/index.js';
import { createHooks } from '../../src/core/app/hooks.js';
import { createI18n } from '../../src/core/i18n/index.js';

test.each(['measure-distance', 'measure-area'])(
  '%s removes only the chosen feature, label and export annotation',
  (id) => {
    let tool;
    const ctx = {
      locale: 'en',
      t: createI18n('en').t,
      hooks: createHooks(),
      annotations: [],
      clicks: { register: () => () => {} },
      tools: { active: () => id },
      ui: {
        toast() {},
        toolbar: { registerTool: (value) => (tool = value) },
      },
      map: {
        addLayer: vi.fn(),
        removeLayer() {},
        addOverlay() {},
        removeOverlay: vi.fn(),
        addInteraction: vi.fn(),
        removeInteraction() {},
        getTargetElement: () => document.body,
      },
      view: { getProjection: () => get('EPSG:3857') },
    };
    const disposable = measure.setup(ctx, { id });
    tool.onActivate();
    const draw = ctx.map.addInteraction.mock.calls[0][0];
    const source = ctx.map.addLayer.mock.calls[0][0].getSource();
    const features = [0, 100].map((offset) => {
      const geometry =
        id === 'measure-area'
          ? new Polygon([
              [
                [offset, 0],
                [offset + 50, 0],
                [offset, 50],
                [offset, 0],
              ],
            ])
          : new LineString([
              [offset, 0],
              [offset + 50, 50],
            ]);
      const feature = new Feature(geometry);
      draw.dispatchEvent({ type: 'drawstart', feature });
      draw.dispatchEvent({ type: 'drawend', feature });
      source.addFeature(feature);
      return feature;
    });
    ctx.map.removeOverlay.mockClear();
    const [first, second] = ctx.annotations;
    const remove = first.element.querySelector('button');
    expect(remove).not.toBeNull();
    expect(remove.getAttribute('aria-label')).toBe('Remove measurement');
    remove.click();
    expect(source.getFeatures()).toEqual([features[1]]);
    expect(ctx.annotations).toEqual([second]);
    expect(ctx.map.removeOverlay).toHaveBeenCalledWith(first.overlay);
    ctx.hooks.emit('map:clear', {});
    expect(source.getFeatures()).toEqual([]);
    expect(ctx.annotations).toEqual([]);
    expect(ctx.map.removeOverlay).toHaveBeenCalledTimes(2);
    disposable.dispose();
  },
);
