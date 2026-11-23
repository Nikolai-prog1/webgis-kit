import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
export function setVersion(
  value,
  root = fileURLToPath(new URL('../', import.meta.url)),
) {
  const version = value.replace(/^v/, '');
  if (!/^\d+\.\d+\.\d+(?:-[a-z0-9]+(?:[.-][a-z0-9]+)*)?$/.test(version))
    throw new Error('Provide a semantic release version.');
  const read = (file) =>
    JSON.parse(fs.readFileSync(path.join(root, file), 'utf8'));
  const pkg = read('package.json'),
    lock = read('package-lock.json'),
    plugin = read('.claude-plugin/plugin.json');
  pkg.version = version;
  lock.version = version;
  lock.packages[''].version = version;
  plugin.version = version;
  for (const [file, data] of [
    ['package.json', pkg],
    ['package-lock.json', lock],
    ['.claude-plugin/plugin.json', plugin],
    ['skills/webgis/ENGINES.json', pkg.engines],
  ])
    fs.writeFileSync(
      path.join(root, file),
      JSON.stringify(data, null, 2) + '\n',
    );
  fs.writeFileSync(
    path.join(root, 'skills/webgis/VERSION'),
    'v' + version + '\n',
  );
  console.log(`Release metadata synchronized: v${version}`);
}
if (
  process.argv[1] &&
  path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)
) {
  try {
    setVersion(process.argv[2] || '');
  } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
  }
}
