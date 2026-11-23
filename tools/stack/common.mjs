import fs from 'node:fs';
import path from 'node:path';
import net from 'node:net';
import crypto from 'node:crypto';
import { spawnSync } from 'node:child_process';

export const secret = () => crypto.randomBytes(24).toString('hex');
export function readEnv(root) {
  const file = path.join(root, '.env');
  const settings = {};
  if (fs.existsSync(file))
    for (const line of fs.readFileSync(file, 'utf8').split(/\r?\n/)) {
      const match = line.match(/^\s*([A-Z_][A-Z0-9_]*)=(.*)$/);
      if (match) {
        let value = match[2].trim();
        if (
          value.length >= 2 &&
          value[0] === value.at(-1) &&
          ['"', "'"].includes(value[0])
        )
          value = value.slice(1, -1);
        settings[match[1]] = value;
      }
    }
  return settings;
}
export function saveEnv(root, settings) {
  const file = path.join(root, '.env');
  let text = fs.existsSync(file)
    ? fs.readFileSync(file, 'utf8')
    : '# Local WebGIS server settings; never commit this file.\n';
  for (const [key, value] of Object.entries(settings)) {
    if (/[\r\n]/.test(String(value)))
      throw new Error('Environment values cannot contain newlines.');
    const line = `${key}=${value}`;
    const pattern = new RegExp(`^${key}=.*$`, 'm');
    text = pattern.test(text)
      ? text.replace(pattern, () => line)
      : text.trimEnd() + '\n' + line + '\n';
  }
  fs.writeFileSync(file, text, { mode: 0o600 });
}
export function metadata(root) {
  const file = path.join(root, '.webgis/project.json');
  return fs.existsSync(file) ? JSON.parse(fs.readFileSync(file, 'utf8')) : {};
}
export function saveMetadata(root, value) {
  fs.mkdirSync(path.join(root, '.webgis'), { recursive: true });
  fs.writeFileSync(
    path.join(root, '.webgis/project.json'),
    JSON.stringify(value, null, 2) + '\n',
  );
}
export function redact(text, settings) {
  for (const [key, value] of Object.entries(settings))
    if (value && /PASSWORD|SECRET|STOP_KEY/.test(key))
      text = text.split(value).join('[redacted]');
  return text;
}
export function run(file, args, options = {}) {
  const result = spawnSync(file, args, {
    encoding: 'utf8',
    windowsHide: true,
    ...options,
  });
  if (result.error || result.status !== 0)
    throw new Error(
      redact(
        result.stderr ||
          result.error?.message ||
          `${path.basename(file)} exited with ${result.status}`,
        options.env || {},
      ),
    );
  return result.stdout?.trim() || '';
}
export async function freePort(start, excluded = []) {
  for (let port = start; port <= 65535; port++) {
    if (excluded.includes(port)) continue;
    const free = await new Promise((resolve) => {
      const server = net.createServer();
      server.once('error', () => resolve(false));
      server.listen(port, '127.0.0.1', () => server.close(() => resolve(true)));
    });
    if (free) return port;
  }
  throw new Error('No free localhost port is available.');
}
export async function http(url, settings, options = {}) {
  const authorization =
    'Basic ' +
    Buffer.from(
      `${settings.GEOSERVER_USER}:${settings.GEOSERVER_PASSWORD}`,
    ).toString('base64');
  return fetch(url, {
    signal: AbortSignal.timeout(5000),
    ...options,
    headers: { Authorization: authorization, ...options.headers },
  });
}
export async function waitFor(check, label, seconds = 120) {
  const end = Date.now() + seconds * 1000;
  while (Date.now() < end) {
    try {
      if (await check()) return;
    } catch {
      /* the service is still starting */
    }
    await new Promise((resolve) => setTimeout(resolve, 750));
  }
  throw new Error(
    `${label} did not become ready; inspect npm run stack -- logs.`,
  );
}
export const required = [
  'WEBGIS_DB_HOST',
  'WEBGIS_DB_PORT',
  'WEBGIS_DB_NAME',
  'WEBGIS_DB_USER',
  'WEBGIS_DB_PASSWORD',
  'GEOSERVER_URL',
  'GEOSERVER_USER',
  'GEOSERVER_PASSWORD',
];
export function existingEnv(root) {
  if (!fs.existsSync(path.join(root, '.env')))
    fs.copyFileSync(
      new URL('../../.env.example', import.meta.url),
      path.join(root, '.env'),
    );
  const current = readEnv(root);
  const defaults = {
    WEBGIS_DB_HOST: 'localhost',
    WEBGIS_DB_PORT: '5432',
    WEBGIS_DB_NAME: 'webgis',
    WEBGIS_DB_USER: 'webgis',
    WEBGIS_DB_PASSWORD: '',
    GEOSERVER_URL: 'http://localhost:8080/geoserver',
    GEOSERVER_USER: 'admin',
    GEOSERVER_PASSWORD: '',
  };
  saveEnv(root, { ...defaults, ...current });
  return { ...defaults, ...current };
}
