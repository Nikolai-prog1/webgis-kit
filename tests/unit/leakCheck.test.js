import fs from 'node:fs';
import path from 'node:path';
import { execFileSync, spawnSync } from 'node:child_process';
import { test, expect } from 'vitest';
const scanner = path.resolve('tools/leak-check.mjs');
const git = (cwd, ...args) =>
  execFileSync('git', args, {
    cwd,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
  });
function fixture() {
  const cache = path.resolve('.cache');
  fs.mkdirSync(cache, { recursive: true });
  const root = fs.mkdtempSync(path.join(cache, 'privacy-'));
  if (!root.startsWith(cache + path.sep))
    throw new Error('Fixture escaped cache');
  git(root, 'init', '-b', 'main');
  git(root, 'config', 'user.name', 'Nikolai-prog1');
  git(root, 'config', 'user.email', 'Nikolai-prog1@users.noreply.github.com');
  fs.writeFileSync(path.join(root, 'CLAUDE.md'), '@AGENTS.md\n');
  fs.writeFileSync(path.join(root, 'sample.txt'), 'safe content\n');
  git(root, 'add', '.');
  git(root, 'commit', '-m', 'chore: synthetic privacy fixture');
  return root;
}
function scan(root) {
  return spawnSync(process.execPath, [scanner], {
    cwd: root,
    encoding: 'utf8',
    env: { ...process.env, LEAKCHECK_DENYLIST: '' },
  });
}
test('privacy scan distinguishes patch controls and code members from real leaks', () => {
  const root = fixture();
  fs.writeFileSync(
    path.join(root, 'code.js'),
    `const value = ${['object', 'local'].join('.')};\n`,
  );
  git(root, 'add', 'code.js');
  expect(scan(root).status).toBe(0);
  const cases = [
    [[10, 123, 45, 67].join('.'), 'private-address'],
    [['server', 'internal'].join('.'), 'private-host'],
    [['employee', 'example.com'].join('@'), 'email'],
    [`${['pass', 'word'].join('')} = '${'fixture-value'}'`, 'credential'],
  ];
  for (const [value, rule] of cases) {
    fs.writeFileSync(path.join(root, 'sample.txt'), value);
    const result = scan(root);
    expect(result.status, rule).toBe(1);
    expect(result.stderr, rule).toContain(rule);
  }
  fs.writeFileSync(path.join(root, 'sample.txt'), 'safe content\n');
  fs.writeFileSync(path.join(root, '.env'), 'LOCAL_VALUE=fixture\n');
  git(root, 'add', '-f', '.env');
  expect(scan(root).stderr).toContain('environment-file');
}, 30000);
test('privacy scan rejects a leak that survives only in history', () => {
  const root = fixture();
  fs.writeFileSync(
    path.join(root, 'sample.txt'),
    ['historical', 'lan'].join('.'),
  );
  git(root, 'add', '.');
  git(root, 'commit', '-m', 'chore: synthetic historical case');
  fs.writeFileSync(path.join(root, 'sample.txt'), 'safe content\n');
  git(root, 'add', '.');
  git(root, 'commit', '-m', 'chore: clear synthetic working copy');
  const result = scan(root);
  expect(result.status).toBe(1);
  expect(result.stderr).toContain('history: private-host');
  expect(result.stderr).not.toContain('sample.txt: private-host');
}, 30000);
test('privacy scan accepts GitHub service addresses and skips remote-tracking branches', () => {
  const root = fixture();
  git(
    root,
    'commit',
    '--allow-empty',
    '-m',
    'chore(deps): bump a dependency',
    '-m',
    `Signed-off-by: dependabot[bot] <${['support', 'github.com'].join('@')}>`,
  );
  expect(scan(root).status).toBe(0);
  const base = git(root, 'rev-parse', 'HEAD').trim();
  git(root, 'checkout', '-q', '-b', 'remote-only');
  fs.writeFileSync(
    path.join(root, 'sample.txt'),
    ['someone', 'example.com'].join('@'),
  );
  git(root, 'add', '.');
  git(root, 'commit', '-m', 'chore: commit that only exists on a remote');
  const tip = git(root, 'rev-parse', 'HEAD').trim();
  git(root, 'checkout', '-q', 'main');
  git(root, 'branch', '-D', 'remote-only');
  git(root, 'update-ref', 'refs/remotes/origin/remote-only', tip);
  expect(git(root, 'rev-parse', 'HEAD').trim()).toBe(base);
  expect(scan(root).status).toBe(0);
}, 30000);
