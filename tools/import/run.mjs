import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
const result = spawnSync(
  process.env.WEBGIS_PYTHON ||
    (process.platform === 'win32' ? 'python' : 'python3'),
  [
    fileURLToPath(new URL('./import_data.py', import.meta.url)),
    ...process.argv.slice(2),
  ],
  { stdio: 'inherit', env: { ...process.env, PYTHONUTF8: '1' } },
);
if (result.error)
  console.error('Install Python 3.10+ or set WEBGIS_PYTHON to its executable.');
process.exitCode = result.status ?? 1;
