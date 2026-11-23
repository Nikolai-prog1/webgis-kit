import { spawnSync, spawn } from 'node:child_process';
import path from 'node:path';
const env = {
  ...process.env,
  WEBGIS_APP_DIR: path.resolve('examples/configs/demo'),
};
const result = spawnSync(
  process.execPath,
  ['node_modules/vite/bin/vite.js', 'build', '--outDir', '.cache/e2e-demo'],
  { env, stdio: 'inherit' },
);
if (result.status) process.exit(result.status);
const server = spawn(
  process.execPath,
  [
    'node_modules/vite/bin/vite.js',
    'preview',
    '--outDir',
    '.cache/e2e-demo',
    '--host',
    '127.0.0.1',
    '--port',
    '4173',
    '--strictPort',
  ],
  { env, stdio: 'inherit' },
);
for (const signal of ['SIGINT', 'SIGTERM'])
  process.on(signal, () => server.kill(signal));
server.on('exit', (code) => process.exit(code || 0));
