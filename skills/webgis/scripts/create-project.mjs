import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const skill = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const run = (command, args, cwd, quiet = false) =>
  execFileSync(command, args, {
    cwd,
    encoding: 'utf8',
    stdio: quiet ? ['ignore', 'pipe', 'pipe'] : 'inherit',
  });
function npm(args, cwd, quiet = false) {
  return process.platform === 'win32'
    ? run(
        process.env.ComSpec || 'cmd.exe',
        ['/d', '/s', '/c', 'npm', ...args],
        cwd,
        quiet,
      )
    : run('npm', args, cwd, quiet);
}
function versions(engines) {
  for (const [name, actual] of [
    ['node', process.versions.node],
    ['npm', npm(['--version'], undefined, true).trim()],
  ]) {
    const minimum = Number(
      (engines[name] || '>=20').replace('>=', '').split('.')[0],
    );
    if (Number(actual.split('.')[0]) < minimum)
      throw new Error(
        `Install ${name} ${engines[name]} before creating this project (found ${actual}).`,
      );
  }
  try {
    run('git', ['--version'], undefined, true);
  } catch {
    throw new Error('Install Git and add git to PATH, then retry.');
  }
}
export function createProject(target, options = {}) {
  const destination = path.resolve(target);
  if (
    fs.existsSync(destination) &&
    (!fs.statSync(destination).isDirectory() ||
      fs.readdirSync(destination).length)
  )
    throw new Error(
      'Choose a new or empty target directory. Existing files are never overwritten.',
    );
  versions(
    JSON.parse(fs.readFileSync(path.join(skill, 'ENGINES.json'), 'utf8')),
  );
  const source =
    options.source ||
    process.env.WEBGIS_KIT_SOURCE ||
    'https://github.com/Nikolai-prog1/webgis-kit.git';
  if (/^https?:/i.test(source)) {
    const url = new URL(source);
    if (url.username || url.password)
      throw new Error(
        'Use a Git credential helper instead of a source URL containing credentials.',
      );
  }
  const ref =
    options.ref || fs.readFileSync(path.join(skill, 'VERSION'), 'utf8').trim();
  if (!ref || ref.startsWith('-'))
    throw new Error('Provide a branch or version tag for --ref.');
  fs.mkdirSync(path.dirname(destination), { recursive: true });
  run('git', [
    'clone',
    '--depth',
    '1',
    '--branch',
    ref,
    '--',
    source,
    destination,
  ]);
  run('git', ['-C', destination, 'remote', 'rename', 'origin', 'upstream']);
  if (
    run('git', ['branch', '--show-current'], destination, true).trim() !==
    'main'
  )
    run('git', ['checkout', '-b', 'main'], destination);
  const packaged = JSON.parse(
    fs.readFileSync(path.join(destination, 'package.json'), 'utf8'),
  );
  versions(packaged.engines || {});
  // app/ is already the starter. Copying the demo is an explicit opt-in; both
  // complete instances remain in the checkout, so no source assets are removed.
  fs.cpSync(
    path.join(
      destination,
      options.demo ? 'examples/configs/demo' : 'templates/starter-app',
    ),
    path.join(destination, 'app'),
    { recursive: true },
  );
  const configFile = path.join(destination, 'app/static/config/app.json');
  const config = JSON.parse(fs.readFileSync(configFile, 'utf8'));
  config.$schema = '../../../src/core/config/schema/app.schema.json';
  if (options.name) {
    config.app.title = options.name;
    config.branding = { ...config.branding, title: options.name };
  }
  fs.writeFileSync(configFile, JSON.stringify(config, null, 2) + '\n');
  fs.mkdirSync(path.join(destination, '.webgis'), { recursive: true });
  fs.writeFileSync(
    path.join(destination, '.webgis/project.json'),
    JSON.stringify(
      { source, ref, createdAt: new Date().toISOString(), mode: null },
      null,
      2,
    ) + '\n',
  );
  if (!options.noInstall) npm(['ci', '--include=dev'], destination);
  console.log(
    `Project ready: ${destination}\nNext: cd into the project, choose npm run stack -- up --mode none (or existing/portable/docker), then npm run import -- <your-data> and npm run dev.`,
  );
  return destination;
}
export function parseArgs(args) {
  const options = {};
  let target;
  for (let index = 0; index < args.length; index++) {
    const value = args[index];
    if (['--source', '--ref', '--name'].includes(value)) {
      if (!args[index + 1] || args[index + 1].startsWith('--'))
        throw new Error(`Missing value for ${value}.`);
      options[value.slice(2)] = args[++index];
    } else if (value === '--no-install') options.noInstall = true;
    else if (value === '--demo') options.demo = true;
    else if (!value.startsWith('-') && !target) target = value;
    else throw new Error(`Unknown argument: ${value}`);
  }
  if (!target)
    throw new Error(
      'Usage: node create-project.mjs <target-dir> [--source <git-url-or-path>] [--ref <tag>] [--name <title>] [--no-install] [--demo]',
    );
  return { target, options };
}
if (
  process.argv[1] &&
  path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)
) {
  try {
    const { target, options } = parseArgs(process.argv.slice(2));
    createProject(target, options);
  } catch (error) {
    console.error(`Cannot create project: ${error.message}`);
    process.exitCode = 1;
  }
}
