import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { test, expect } from 'vitest';
import { updateCore } from '../../tools/update-core.mjs';
const git = (cwd, ...args) =>
  execFileSync('git', args, {
    cwd,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
  });
test('core updates remove obsolete files and preserve the complete instance boundary', () => {
  const cache = path.resolve('.cache');
  fs.mkdirSync(cache, { recursive: true });
  const directory = fs.mkdtempSync(path.join(cache, 'update-'));
  const upstream = path.join(directory, 'upstream'),
    local = path.join(directory, 'local');
  fs.mkdirSync(upstream);
  git(upstream, 'init', '-b', 'main');
  git(upstream, 'config', 'user.name', 'Nikolai-prog1');
  git(
    upstream,
    'config',
    'user.email',
    'Nikolai-prog1@users.noreply.github.com',
  );
  function write(root, name, text) {
    const file = path.join(root, name);
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, text);
  }
  write(upstream, '.gitignore', '.env\n');
  write(upstream, 'src/obsolete.js', 'export default 1;\n');
  write(upstream, 'app/config.json', '{"owned":true}\n');
  write(upstream, 'README.md', 'instance readme');
  write(upstream, 'LICENSE', 'instance license');
  write(
    upstream,
    'package.json',
    JSON.stringify({ scripts: { dev: 'old' }, dependencies: { ol: '1' } }),
  );
  write(upstream, 'CHANGELOG.md', '# Changelog\n\n## 0.1.0\nOld\n');
  git(upstream, 'add', '.');
  git(upstream, 'commit', '-m', 'chore: fixture');
  git(upstream, 'tag', 'v0.1.0');
  git(directory, 'clone', upstream, local);
  git(local, 'config', 'user.name', 'Nikolai-prog1');
  git(local, 'config', 'user.email', 'Nikolai-prog1@users.noreply.github.com');
  git(local, 'remote', 'add', 'upstream', upstream);
  write(local, '.env', 'LOCAL_VALUE=preserve-me\n');
  fs.unlinkSync(path.join(upstream, 'src/obsolete.js'));
  write(upstream, 'src/new.js', 'export default 2;\n');
  write(upstream, 'app/config.json', '{"owned":false}\n');
  write(upstream, 'README.md', 'upstream readme');
  write(upstream, 'LICENSE', 'upstream license');
  write(
    upstream,
    'package.json',
    JSON.stringify({ scripts: { dev: 'new' }, dependencies: { ol: '2' } }),
  );
  write(upstream, 'CHANGELOG.md', '# Changelog\n\n## 0.2.0\nNew\n');
  git(upstream, 'add', '-A');
  git(upstream, 'commit', '-m', 'feat: fixture update');
  git(upstream, 'tag', 'v0.2.0');
  const packageBefore = fs.readFileSync(
    path.join(local, 'package.json'),
    'utf8',
  );
  const changes = updateCore('v0.2.0', local);
  expect(fs.existsSync(path.join(local, 'src/obsolete.js'))).toBe(false);
  expect(fs.readFileSync(path.join(local, 'src/new.js'), 'utf8')).toContain(
    '2',
  );
  expect(
    fs.readFileSync(path.join(local, 'app/config.json'), 'utf8'),
  ).toContain('true');
  expect(fs.readFileSync(path.join(local, '.env'), 'utf8')).toContain(
    'preserve-me',
  );
  expect(fs.readFileSync(path.join(local, 'README.md'), 'utf8')).toBe(
    'instance readme',
  );
  expect(fs.readFileSync(path.join(local, 'LICENSE'), 'utf8')).toBe(
    'instance license',
  );
  expect(fs.readFileSync(path.join(local, 'package.json'), 'utf8')).toBe(
    packageBefore,
  );
  expect(changes.dependencies.ol.upstream).toBe('2');
  expect(git(local, 'diff', '--cached', '--name-status')).toContain(
    'src/obsolete.js',
  );
  expect(() => updateCore('v0.2.0', local)).toThrow('Commit or stash');
}, 15000);
