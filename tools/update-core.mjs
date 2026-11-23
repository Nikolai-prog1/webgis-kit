import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
export const corePaths = [
  'src',
  'tools',
  'skills',
  'docs',
  'examples',
  'templates',
  'stack',
  'tests',
  '.claude-plugin',
  'index.html',
  'vite.config.js',
  'eslint.config.js',
  'jsconfig.json',
  'AGENTS.md',
  'CLAUDE.md',
  'CHANGELOG.md',
];
const git = (cwd, ...args) =>
  execFileSync('git', args, {
    cwd,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
  });
export function updateCore(tag, cwd = process.cwd()) {
  if (!/^v?\d+\.\d+\.\d+(?:[-+][A-Za-z0-9.-]+)?$/.test(tag))
    throw new Error('Provide a version tag such as v0.1.0.');
  if (git(cwd, 'status', '--porcelain').trim())
    throw new Error(
      'Commit or stash all working-tree changes before updating core.',
    );
  try {
    git(cwd, 'remote', 'get-url', 'upstream');
  } catch {
    git(
      cwd,
      'remote',
      'add',
      'upstream',
      'https://github.com/Nikolai-prog1/webgis-kit.git',
    );
  }
  git(cwd, 'fetch', 'upstream', '--tags');
  git(cwd, 'rev-parse', '--verify', `${tag}^{commit}`);
  const upstream = JSON.parse(git(cwd, 'show', `${tag}:package.json`));
  const local = JSON.parse(
    fs.readFileSync(path.join(cwd, 'package.json'), 'utf8'),
  );
  const changes = {};
  for (const section of ['dependencies', 'devDependencies', 'scripts']) {
    const diff = {};
    for (const key of new Set([
      ...Object.keys(local[section] || {}),
      ...Object.keys(upstream[section] || {}),
    ]))
      if (local[section]?.[key] !== upstream[section]?.[key])
        diff[key] = {
          local: local[section]?.[key] ?? null,
          upstream: upstream[section]?.[key] ?? null,
        };
    if (Object.keys(diff).length) changes[section] = diff;
  }
  const upstreamNames = git(cwd, 'ls-tree', '--name-only', tag)
    .trim()
    .split('\n');
  const tracked = git(cwd, 'ls-files').split('\n');
  const paths = corePaths.filter(
    (name) =>
      upstreamNames.includes(name) ||
      tracked.some((file) => file === name || file.startsWith(`${name}/`)),
  );
  if (paths.length)
    git(
      cwd,
      'restore',
      `--source=${tag}`,
      '--staged',
      '--worktree',
      '--',
      ...paths,
    );
  console.log(
    'Core changes are staged. Review git diff --cached before committing.',
  );
  console.log(
    'Package differences (package.json and package-lock.json were preserved):\n' +
      JSON.stringify(changes, null, 2),
  );
  const changelog = git(cwd, 'show', `${tag}:CHANGELOG.md`);
  console.log(
    changelog
      .split(/\n(?=## )/)
      .slice(0, 2)
      .join('\n'),
  );
  return changes;
}
if (
  process.argv[1] &&
  path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)
) {
  try {
    updateCore(process.argv[2] || 'v0.1.0');
  } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
  }
}
