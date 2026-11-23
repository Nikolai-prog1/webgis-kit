// @vitest-environment node
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { test, expect } from 'vitest';
import { createProject } from '../../skills/webgis/scripts/create-project.mjs';

test('bootstrap from a local bare source preserves existing folders and offers starter/demo modes', () => {
  fs.mkdirSync('.cache', { recursive: true });
  const base = fs.mkdtempSync(path.resolve('.cache/bootstrap-'));
  const source = path.join(base, 'source');
  const bare = path.join(base, 'source.git');
  fs.mkdirSync(source);
  const git = (...args) =>
    execFileSync('git', args, { cwd: source, stdio: 'pipe' });
  git('init', '-b', 'main');
  git('config', 'user.name', 'Fixture');
  git('config', 'user.email', 'fixture@users.noreply.github.com');
  fs.writeFileSync(
    path.join(source, 'package.json'),
    '{"engines":{"node":">=20","npm":">=9"}}',
  );
  for (const folder of [
    'app',
    'templates/starter-app',
    'examples/configs/demo',
  ]) {
    fs.cpSync('templates/starter-app', path.join(source, folder), {
      recursive: true,
    });
  }
  const demoFile = path.join(
    source,
    'examples/configs/demo/static/config/app.json',
  );
  const demo = JSON.parse(fs.readFileSync(demoFile));
  demo.app.title = 'Demonstration';
  fs.writeFileSync(demoFile, JSON.stringify(demo));
  git('add', '.');
  git('commit', '-m', 'fixture');
  execFileSync('git', ['clone', '--bare', source, bare], { stdio: 'pipe' });
  const target = path.join(base, 'new');
  createProject(target, {
    source: bare,
    ref: 'main',
    noInstall: true,
    name: 'Neutral map',
    locale: 'bg',
  });
  expect(
    execFileSync('git', ['remote', 'get-url', 'upstream'], {
      cwd: target,
      encoding: 'utf8',
    }).trim(),
  ).toBe(bare);
  // Fetching updates stays possible; pushing to the template is not.
  expect(
    execFileSync('git', ['remote', 'get-url', '--push', 'upstream'], {
      cwd: target,
      encoding: 'utf8',
    }).trim(),
  ).toBe('no-push');
  const created = JSON.parse(
    fs.readFileSync(path.join(target, 'app/static/config/app.json')),
  ).app;
  expect(created.locale).toBe('bg');
  expect(created.locales[0]).toBe('bg');
  expect(
    execFileSync('git', ['branch', '--show-current'], {
      cwd: target,
      encoding: 'utf8',
    }).trim(),
  ).toBe('main');
  expect(
    JSON.parse(fs.readFileSync(path.join(target, 'app/static/config/app.json')))
      .app.title,
  ).toBe('Neutral map');
  expect(
    JSON.parse(fs.readFileSync(path.join(target, '.webgis/project.json'))).mode,
  ).toBeNull();
  expect(() =>
    createProject(target, { source: bare, ref: 'main', noInstall: true }),
  ).toThrow('empty target');
  const empty = path.join(base, 'empty');
  fs.mkdirSync(empty);
  createProject(empty, {
    source: bare,
    ref: 'main',
    noInstall: true,
    demo: true,
  });
  expect(
    JSON.parse(fs.readFileSync(path.join(empty, 'app/static/config/app.json')))
      .app.title,
  ).toBe('Demonstration');
}, 30000);

test('bootstrap refuses inline credentials before invoking git', () => {
  fs.mkdirSync('.cache', { recursive: true });
  const target = path.join(
    fs.mkdtempSync(path.resolve('.cache/bootstrap-credentials-')),
    'target',
  );
  expect(() =>
    createProject(target, {
      source: 'https://user:fixture-secret@localhost/kit.git',
      noInstall: true,
    }),
  ).toThrow('credential helper');
  expect(fs.existsSync(target)).toBe(false);
});
