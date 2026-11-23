// @vitest-environment node
import fs from 'node:fs';
import path from 'node:path';
import { test, expect } from 'vitest';
import { setVersion } from '../../tools/release-version.mjs';
test('bootstrap and plugin metadata use the packaged release and engine requirements', () => {
  const pkg = JSON.parse(fs.readFileSync('package.json', 'utf8'));
  const plugin = JSON.parse(
    fs.readFileSync('.claude-plugin/plugin.json', 'utf8'),
  );
  const engines = JSON.parse(
    fs.readFileSync('skills/webgis/ENGINES.json', 'utf8'),
  );
  expect(plugin.version).toBe(pkg.version);
  expect(fs.readFileSync('skills/webgis/VERSION', 'utf8').trim()).toBe(
    'v' + pkg.version,
  );
  expect(engines).toEqual(pkg.engines);
});
test('release tooling synchronizes all metadata in an isolated fixture', () => {
  fs.mkdirSync('.cache/release-tests', { recursive: true });
  const root = fs.mkdtempSync(path.resolve('.cache/release-tests/fixture-'));
  fs.mkdirSync(path.join(root, '.claude-plugin'));
  fs.mkdirSync(path.join(root, 'skills/webgis'), { recursive: true });
  for (const [file, value] of [
    [
      'package.json',
      { version: '0.0.0', engines: { node: '>=24', npm: '>=11' } },
    ],
    [
      'package-lock.json',
      { version: '0.0.0', packages: { '': { version: '0.0.0' } } },
    ],
    ['.claude-plugin/plugin.json', { version: '0.0.0' }],
  ])
    fs.writeFileSync(path.join(root, file), JSON.stringify(value));
  setVersion('0.2.0-rc.1', root);
  expect(
    JSON.parse(fs.readFileSync(path.join(root, 'package-lock.json'))).packages[
      ''
    ].version,
  ).toBe('0.2.0-rc.1');
  expect(
    fs.readFileSync(path.join(root, 'skills/webgis/VERSION'), 'utf8').trim(),
  ).toBe('v0.2.0-rc.1');
  expect(
    JSON.parse(fs.readFileSync(path.join(root, 'skills/webgis/ENGINES.json'))),
  ).toEqual({ node: '>=24', npm: '>=11' });
});
