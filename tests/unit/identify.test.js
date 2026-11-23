import { test, expect, vi, afterEach } from 'vitest';
import { get } from 'ol/proj.js';
import identify from '../../src/core/modules/identify/index.js';
import { createHooks } from '../../src/core/app/hooks.js';
afterEach(() => {
  vi.unstubAllGlobals();
  vi.useRealTimers();
});
function setup(responses, hoverCursor = false) {
  const fetch = vi.fn(async () => await responses.shift());
  vi.stubGlobal('fetch', fetch);
  let handler, hover;
  const ctx = {
    tools: { active: () => false },
    layers: {
      all: () => [
        {
          def: { title: 'Fixture', queryable: true, source: { type: 'wms' } },
          layer: {
            getVisible: () => true,
            getZIndex: () => 1,
            getSource: () => ({
              getFeatureInfoUrl: (_point, _resolution, _projection, params) =>
                `https://example.com/wms?INFO_FORMAT=${encodeURIComponent(params.INFO_FORMAT)}`,
            }),
          },
        },
      ],
    },
    config: { identify: { featureCount: 5, buffer: 12, hoverCursor } },
    clicks: {
      register: (value) => {
        handler = value.handle;
        return () => {};
      },
    },
    view: { getResolution: () => 1, getProjection: () => get('EPSG:3857') },
    ui: { popup: { show: vi.fn(), showFeature: vi.fn() } },
    hooks: createHooks(),
    map: {
      getTargetElement: () => document.body,
      on: (_type, listener) => {
        hover = listener;
        return { listener };
      },
      un() {},
    },
    localized: (value) => value,
  };
  identify.setup(ctx);
  return {
    fetch,
    ctx,
    click: () => handler({ pixel: [0, 0], coordinate: [0, 0] }),
    hover: () => hover({ pixel: [0, 0], coordinate: [0, 0] }),
  };
}
const empty = () => new Response('{"type":"FeatureCollection","features":[]}');
const emptyGml = () =>
  new Response(
    '<wfs:FeatureCollection xmlns:wfs="http://www.opengis.net/wfs"/>',
  );
test('valid empty JSON does not cause GML or text fallback requests', async () => {
  const fixture = setup([empty(), emptyGml(), new Response('no features')]);
  expect(await fixture.click()).toBe(false);
  expect(fixture.fetch).toHaveBeenCalledTimes(1);
});

test('map clear cancels a queued hover before any request is sent', async () => {
  vi.useFakeTimers();
  const fixture = setup([empty()], true);
  fixture.hover();
  fixture.ctx.hooks.emit('map:clear', {});
  await vi.advanceTimersByTimeAsync(200);
  expect(fixture.fetch).not.toHaveBeenCalled();
});

test('clearing a pending hover preserves popup controls and ignores the late hover result', async () => {
  vi.useFakeTimers();
  let resolve;
  const fixture = setup([new Promise((done) => (resolve = done))], true);
  const popup = fixture.ctx.ui.popup;
  fixture.hover();
  await vi.advanceTimersByTimeAsync(120);
  expect(fixture.ctx.ui.popup).toBe(popup);
  fixture.ctx.hooks.emit('map:clear', {});
  expect(fixture.fetch.mock.calls[0][1].signal.aborted).toBe(true);
  resolve(
    new Response(
      '{"type":"FeatureCollection","features":[{"type":"Feature","properties":{"name":"Late"},"geometry":null}]}',
    ),
  );
  await vi.advanceTimersByTimeAsync(0);
  expect(fixture.ctx.ui.popup).toBe(popup);
  expect(popup.showFeature).not.toHaveBeenCalled();
  expect(document.body.style.cursor).toBe('');
});
test('an OGC exception permits GML fallback but valid empty GML stops it', async () => {
  const fixture = setup([
    new Response(
      '<ServiceExceptionReport><ServiceException>JSON unavailable</ServiceException></ServiceExceptionReport>',
      { status: 400 },
    ),
    emptyGml(),
    new Response('no features'),
  ]);
  expect(await fixture.click()).toBe(false);
  expect(fixture.fetch).toHaveBeenCalledTimes(2);
});
test('unreadable JSON and GML still permit the text fallback', async () => {
  const fixture = setup([
    new Response('invalid json'),
    new Response('<html>Not feature data</html>'),
    new Response('name = Fixture'),
  ]);
  expect(await fixture.click()).toBe(true);
  expect(fixture.fetch).toHaveBeenCalledTimes(3);
  expect(fixture.ctx.ui.popup.show).toHaveBeenCalled();
});

test('map clear aborts an outstanding identify and prevents a late popup or fallback', async () => {
  let resolve;
  const fixture = setup([new Promise((done) => (resolve = done))]);
  const pending = fixture.click();
  const signal = fixture.fetch.mock.calls[0][1].signal;
  fixture.ctx.hooks.emit('map:clear', {});
  const aborted = signal.aborted;
  resolve(
    new Response(
      '{"type":"FeatureCollection","features":[{"type":"Feature","properties":{"name":"Late"},"geometry":null}]}',
    ),
  );
  await pending;
  expect(aborted).toBe(true);
  expect(fixture.ctx.ui.popup.showFeature).not.toHaveBeenCalled();
  expect(fixture.fetch).toHaveBeenCalledTimes(1);
});
