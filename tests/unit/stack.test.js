// @vitest-environment node
import fs from 'node:fs';
import path from 'node:path';
import net from 'node:net';
import { test, expect, vi } from 'vitest';
import {
  readEnv,
  saveEnv,
  freePort,
  existingEnv,
  secret,
  redact,
  metadata,
} from '../../tools/stack/common.mjs';
import { main, parseArgs } from '../../tools/stack/index.mjs';
import {
  hash,
  launcher,
  preparePortableLibraries,
  checksumExpectation,
} from '../../tools/stack/portable.mjs';
function directory() {
  fs.mkdirSync('.cache/stack-tests', { recursive: true });
  return fs.mkdtempSync(path.resolve('.cache/stack-tests/project-'));
}
test('existing mode creates placeholders and reports missing settings without passwords', async () => {
  const root = directory(),
    output = [];
  const consoleSpy = vi
    .spyOn(console, 'log')
    .mockImplementation((value) => output.push(value));
  expect(await main(['up', '--mode', 'existing', '--instance', root])).toBe(1);
  expect(existingEnv(root).GEOSERVER_PASSWORD).toBe('');
  expect(metadata(root).mode).toBe('existing');
  expect(output.join('\n')).toContain('Fill these settings');
  consoleSpy.mockRestore();
});
test('local environment updates retain comments and unrelated keys; env never reveals credentials', async () => {
  const root = directory();
  fs.writeFileSync(path.join(root, '.env'), '# Retain this\nOTHER=value\n');
  saveEnv(root, {
    WEBGIS_DB_PASSWORD: 'fixture-password',
    GEOSERVER_PASSWORD: 'fixture-login',
  });
  expect(fs.readFileSync(path.join(root, '.env'), 'utf8')).toContain(
    '# Retain this',
  );
  expect(readEnv(root).OTHER).toBe('value');
  const output = [];
  const consoleSpy = vi
    .spyOn(console, 'log')
    .mockImplementation((value) => output.push(value));
  await main(['env', '--instance', root]);
  consoleSpy.mockRestore();
  expect(output.join('\n')).not.toContain('fixture-password');
  expect(output.join('\n')).not.toContain('fixture-login');
  expect(
    redact('fixture-password fixture-login', {
      WEBGIS_DB_PASSWORD: 'fixture-password',
      GEOSERVER_PASSWORD: 'fixture-login',
    }),
  ).toBe('[redacted] [redacted]');
});
test('none mode records the choice and down retains all project data', async () => {
  const root = directory();
  fs.writeFileSync(path.join(root, 'retain.txt'), 'retained');
  expect(await main(['up', '--mode', 'none', '--instance', root])).toBe(0);
  expect(await main(['status', '--instance', root])).toBe(0);
  expect(await main(['down', '--instance', root])).toBe(0);
  expect(metadata(root).mode).toBe('none');
  expect(fs.readFileSync(path.join(root, 'retain.txt'), 'utf8')).toBe(
    'retained',
  );
});
test('free-port selection skips occupied and reserved ports', async () => {
  const server = net.createServer();
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  const occupied = server.address().port;
  try {
    expect(await freePort(occupied, [occupied + 1])).toBeGreaterThan(
      occupied + 1,
    );
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
});
test('archive hashes and random credentials are deterministic and independent respectively', async () => {
  const root = directory(),
    file = path.join(root, 'hash.txt');
  fs.writeFileSync(file, 'abc');
  expect(await hash(file)).toBe(
    'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad',
  );
  expect(secret()).toMatch(/^[0-9a-f]{48}$/);
  expect(secret()).not.toBe(secret());
  const script = launcher();
  expect(script).toContain('jetty.http.host=127.0.0.1');
  expect(script).toContain('"-Djava.io.tmpdir=%WEBGIS_TMP%"');
  expect(script).toContain('"-Djdk.net.unixdomain.tmpdir=%WEBGIS_TMP%"');
});
test('invalid modes and attempts to reuse a managed project for another mode fail', async () => {
  expect(() => parseArgs(['up', '--mode', 'unknown'])).toThrow('mode');
  const root = directory();
  fs.mkdirSync(path.join(root, '.webgis'));
  fs.writeFileSync(
    path.join(root, '.webgis/project.json'),
    '{"mode":"portable"}',
  );
  await expect(
    main(['up', '--mode', 'docker', '--instance', root]),
  ).rejects.toThrow('new project');
});

test('portable dependencies come from the same archive and retain the original DLL', () => {
  const bin = directory();
  fs.mkdirSync(path.join(bin, 'postgisgui'));
  fs.writeFileSync(path.join(bin, 'libcurl.dll'), 'requires missing http2');
  fs.writeFileSync(
    path.join(bin, 'postgisgui/libcurl.dll'),
    'complete bundled variant',
  );
  preparePortableLibraries(bin);
  expect(fs.readFileSync(path.join(bin, 'libcurl.dll'), 'utf8')).toBe(
    'complete bundled variant',
  );
  expect(
    fs.readFileSync(path.join(bin, 'libcurl-with-http2.dll'), 'utf8'),
  ).toBe('requires missing http2');
  preparePortableLibraries(bin);
  expect(
    fs.readFileSync(path.join(bin, 'libcurl-with-http2.dll'), 'utf8'),
  ).toBe('requires missing http2');
});

test('offline manifests cannot replace a pinned publisher checksum', () => {
  const publisher = 'a'.repeat(64),
    supplied = 'b'.repeat(64);
  expect(checksumExpectation(publisher)).toBe(publisher);
  expect(checksumExpectation(undefined, supplied)).toBe(supplied);
  expect(() => checksumExpectation(publisher, supplied)).toThrow('conflicts');
  expect(() => checksumExpectation(undefined, '1234')).toThrow('SHA-256');
});

test('quoted connection values keep embedded and trailing quote characters', () => {
  const root = directory();
  fs.writeFileSync(
    path.join(root, '.env'),
    `GEOSERVER_PASSWORD='fixture"'\nWEBGIS_DB_PASSWORD=fixture"\n`,
  );
  expect(readEnv(root).GEOSERVER_PASSWORD).toBe('fixture"');
  expect(readEnv(root).WEBGIS_DB_PASSWORD).toBe('fixture"');
});
