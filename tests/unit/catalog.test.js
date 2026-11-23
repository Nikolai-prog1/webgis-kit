import fs from 'node:fs';
import { test, expect } from 'vitest';
import { DOMParser as ServerDOMParser } from '@xmldom/xmldom';
import {
  parseCapabilities,
  capabilitiesToCatalog,
  wildcard,
} from '../../src/core/data/wmsCapabilities.js';
import { legendSymbol } from '../../src/core/ui/legendSymbols.js';
import { compensatedDpi } from '../../src/core/map/scaleCompensation.js';
const fixture = (version) =>
  fs.readFileSync(`tests/fixtures/capabilities-${version}.xml`, 'utf8');
test('1.1.1 inherits bbox queryability and diagonal ScaleHint', () => {
  const tree = parseCapabilities(fixture('1.1'));
  const parks = tree.layer.children[0].children[0],
    roads = tree.layer.children[0].children[1];
  expect(parks.extent).toEqual([-10, 30, 30, 60]);
  expect(parks.queryable).toBe(true);
  expect(roads.queryable).toBe(false);
  expect(parks.maxScale).toBeCloseTo(100 / ((0.0254 / 72) * Math.SQRT2));
  expect(parks.legendUrl).toBe('https://example.com/legend.png');
});
test('1.3.0 hierarchy and static catalog work in Node and browser parsers', () => {
  const tree = parseCapabilities(fixture('1.3'), new ServerDOMParser());
  const catalog = capabilitiesToCatalog(tree, {
    id: 'external',
    service: 'external',
    include: ['OSM*'],
  });
  expect(catalog.groups).toHaveLength(1);
  const def = catalog.groups[0].layers[0];
  expect(def.source.layers).toBe('OSM-WMS');
  expect(def.maxScale).toBe(50000000);
  expect(def.extent).toEqual([-180, -80, 180, 80]);
  expect(wildcard('sample:*', 'sample:roads')).toBe(true);
  expect(
    capabilitiesToCatalog(tree, {
      id: 'external',
      service: 'external',
      exclude: ['*'],
    }).groups,
  ).toHaveLength(0);
});

test('top-level leaves share a root group while real nested groups remain intact', () => {
  const xml =
    '<WMS_Capabilities version="1.3.0"><Service><Title>Service</Title></Service><Capability><Layer><Title>Workspace layers</Title><Layer><Name>demo:one</Name><Title>One</Title></Layer><Layer><Title>Nested</Title><Layer><Name>demo:two</Name><Title>Two</Title></Layer></Layer><Layer><Name>demo:three</Name><Title>Three</Title></Layer></Layer></Capability></WMS_Capabilities>';
  const tree = parseCapabilities(xml);
  const catalog = capabilitiesToCatalog(tree, {
    id: 'demo',
    title: 'Catalog',
    service: 'main',
  });
  expect(catalog.groups.map((group) => group.title)).toEqual([
    'Workspace layers',
    'Nested',
  ]);
  expect(catalog.groups[0].layers.map((layer) => layer.source.layers)).toEqual([
    'demo:one',
    'demo:three',
  ]);
  expect(catalog.groups[1].layers[0].source.layers).toBe('demo:two');
  tree.layer.title = '';
  expect(
    capabilitiesToCatalog(tree, {
      id: 'demo',
      title: 'Catalog',
      service: 'main',
    }).groups[0].title,
  ).toBe('Catalog');
});
test('legend symbols represent shapes safely', () => {
  for (const shape of ['circle', 'triangle', 'diamond', 'square']) {
    const symbol = legendSymbol({
      type: 'point',
      shape,
      fill: '#123456',
      stroke: '#fff',
    });
    expect(symbol.tagName.toLowerCase()).toBe('svg');
    expect(symbol.childElementCount).toBe(1);
  }
  const symbol = legendSymbol({
    type: 'polygon',
    fill: 'url(javascript:alert(1))',
  });
  expect(symbol.querySelector('rect').getAttribute('fill')).toBe('none');
});
test('DPI compensation has a lower bound and respects minimum scale', () => {
  expect(compensatedDpi(100, 100000, null, 192)).toBeLessThan(192);
  expect(compensatedDpi(10000, 100, null, 96)).toBe(15);
  expect(compensatedDpi(100, 100000, 200000, 96)).toBe(96);
});

test('polygon legend hatches have isolated safe SVG patterns', () => {
  const item = {
    type: 'polygon',
    fill: '#fff',
    fillOpacity: 0,
    stroke: '#123456',
    hatch: { color: 'url(javascript:alert(1))', angle: 45, spacing: 5 },
  };
  const first = legendSymbol(item),
    second = legendSymbol(item);
  expect(first.querySelector('pattern').id).not.toBe(
    second.querySelector('pattern').id,
  );
  expect(first.querySelector('pattern path').getAttribute('stroke')).toBe(
    'none',
  );
  expect(first.querySelector('pattern').getAttribute('patternTransform')).toBe(
    'rotate(45)',
  );
  expect(
    first.querySelector('rect:last-child').getAttribute('fill-opacity'),
  ).toBe('1');
});
