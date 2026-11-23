import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  existingEnv,
  readEnv,
  saveEnv,
  metadata,
  saveMetadata,
  redact,
  required,
  run,
  secret,
  freePort,
  http,
  waitFor,
} from './common.mjs';
import { upPortable, downPortable } from './portable.mjs';
const rootDir = fileURLToPath(new URL('../../', import.meta.url));
export function parseArgs(args) {
  const command = args.shift() || 'status',
    options = {};
  if (!['status', 'up', 'down', 'logs', 'env'].includes(command))
    throw new Error('Choose stack status, up, down, logs or env.');
  for (let i = 0; i < args.length; i++) {
    if (
      !['--mode', '--downloads', '--instance'].includes(args[i]) ||
      !args[i + 1]
    )
      throw new Error(
        'Options: --mode existing|portable|docker|none, --downloads <dir>, --instance <dir>.',
      );
    options[args[i].slice(2)] = args[++i];
  }
  if (
    options.mode &&
    !['existing', 'portable', 'docker', 'none'].includes(options.mode)
  )
    throw new Error('Unknown stack mode.');
  return { command, options };
}
function compose(root, state, args, settings = readEnv(root), options = {}) {
  return run(
    'docker',
    [
      'compose',
      '--env-file',
      path.join(root, '.env'),
      '-f',
      path.join(rootDir, 'stack/docker-compose.yml'),
      '-p',
      state.stackName,
      ...args,
    ],
    { env: { ...process.env, ...settings }, ...options },
  );
}
export async function status(
  root,
  state,
  settings = { ...readEnv(root), ...process.env },
) {
  if (state.mode === 'none') {
    console.log('Mode none: local GeoJSON; no server is required.');
    return true;
  }
  const missing = required.filter((key) => !settings[key]);
  if (missing.length) {
    console.log('Fill these settings in .env: ' + missing.join(', '));
    return false;
  }
  let pg = false,
    gs = false;
  try {
    const options = [
      '-h',
      settings.WEBGIS_DB_HOST,
      '-p',
      settings.WEBGIS_DB_PORT,
      '-U',
      settings.WEBGIS_DB_USER,
      '-d',
      settings.WEBGIS_DB_NAME,
      '--no-password',
      '-tAc',
      'SELECT postgis_full_version()',
    ];
    if (settings.WEBGIS_PSQL)
      run(settings.WEBGIS_PSQL, options, {
        env: {
          ...process.env,
          ...settings,
          PGPASSWORD: settings.WEBGIS_DB_PASSWORD,
        },
      });
    else if (state.mode === 'docker')
      compose(
        root,
        state,
        [
          'exec',
          '-T',
          '-e',
          'PGPASSWORD',
          'db',
          'psql',
          '-h',
          'localhost',
          '-U',
          settings.WEBGIS_DB_USER,
          '-d',
          settings.WEBGIS_DB_NAME,
          '--no-password',
          '-tAc',
          'SELECT postgis_full_version()',
        ],
        { ...settings, PGPASSWORD: settings.WEBGIS_DB_PASSWORD },
      );
    else
      run('psql', options, {
        env: {
          ...process.env,
          ...settings,
          PGPASSWORD: settings.WEBGIS_DB_PASSWORD,
        },
      });
    pg = true;
  } catch (error) {
    console.log('PostGIS unavailable: ' + redact(error.message, settings));
  }
  try {
    gs = (
      await http(
        settings.GEOSERVER_URL.replace(/\/$/, '') + '/rest/about/version.json',
        settings,
      )
    ).ok;
  } catch {
    /* status is false and no credential is printed */
  }
  console.log(
    `PostGIS: ${pg ? 'ready' : 'unavailable'}; GeoServer REST login: ${gs ? 'ready' : 'unavailable'}.`,
  );
  return pg && gs;
}
async function upDocker(root, state) {
  run('docker', ['compose', 'version']);
  const old = readEnv(root);
  if (
    state.mode !== 'docker' &&
    ['GEOSERVER_PASSWORD', 'WEBGIS_DB_PASSWORD', 'PG_SUPERUSER_PASSWORD'].some(
      (key) => old[key],
    )
  )
    throw new Error(
      'Use a new project for a new Docker stack; existing server credentials are retained.',
    );
  const pgPort = state.pgPort || (await freePort(5433)),
    gsPort = state.gsPort || (await freePort(8080, [pgPort]));
  const home = path.join(root, '.local-stack');
  fs.mkdirSync(home, { recursive: true });
  const settings = {
    ...old,
    WEBGIS_DB_HOST: '127.0.0.1',
    WEBGIS_DB_PORT: String(pgPort),
    WEBGIS_DB_SERVER_HOST: 'db',
    WEBGIS_DB_SERVER_PORT: '5432',
    WEBGIS_DB_NAME: 'webgis',
    WEBGIS_DB_USER: 'webgis',
    WEBGIS_DB_PASSWORD: old.WEBGIS_DB_PASSWORD || secret(),
    PG_SUPERUSER_PASSWORD: old.PG_SUPERUSER_PASSWORD || secret(),
    GEOSERVER_URL: `http://127.0.0.1:${gsPort}/geoserver`,
    GEOSERVER_USER: 'admin',
    GEOSERVER_PASSWORD: old.GEOSERVER_PASSWORD || secret(),
    WEBGIS_GS_PORT: String(gsPort),
    WEBGIS_STACK_HOME: home.replaceAll('\\', '/'),
  };
  saveEnv(root, settings);
  Object.assign(state, {
    mode: 'docker',
    stackName: state.stackName || 'webgis-' + secret().slice(0, 10),
    pgPort,
    gsPort,
  });
  saveMetadata(root, state);
  // The database role is created by stack/initdb/20-webgis.sh inside the
  // container from WEBGIS_DB_PASSWORD; no credential file is bind-mounted.
  compose(
    root,
    state,
    ['up', '-d', '--wait', '--wait-timeout', '180'],
    settings,
  );
  await waitFor(
    async () =>
      (
        await http(
          settings.GEOSERVER_URL + '/rest/about/version.json',
          settings,
        )
      ).ok,
    'GeoServer',
    180,
  );
  if (!(await status(root, state, settings)))
    throw new Error('Docker stack health verification failed.');
  console.log(
    'Docker stack ready. Use npm run stack -- down to stop it without deleting volumes.',
  );
}
export async function main(args = process.argv.slice(2)) {
  const { command, options } = parseArgs([...args]);
  const root = path.resolve(
    options.instance || process.env.WEBGIS_APP_DIR || '.',
  );
  const state = metadata(root);
  if (options.mode && command !== 'up')
    throw new Error('--mode is selected with stack up.');
  if (command === 'up') {
    const mode = options.mode || state.mode || 'none';
    if (
      state.mode &&
      state.mode !== mode &&
      ['docker', 'portable'].includes(state.mode)
    )
      throw new Error(
        'Use a new project for a different managed stack; existing data is retained.',
      );
    if (mode === 'portable') await upPortable(root, state, options);
    else if (mode === 'docker') await upDocker(root, state);
    else {
      state.mode = mode;
      saveMetadata(root, state);
      if (mode === 'existing') {
        existingEnv(root);
        if (!(await status(root, state))) return 1;
      } else
        console.log(
          'Mode none selected. Import vectors with --target geojson; no server is started.',
        );
    }
  } else if (command === 'env') {
    const settings = { ...readEnv(root), ...process.env };
    for (const key of required)
      console.log(`${key}: ${settings[key] ? 'set' : 'missing'}`);
  } else if (command === 'status') {
    if (!state.mode) {
      console.log(
        'No mode selected. Run npm run stack -- up --mode none|existing|portable|docker.',
      );
      return 1;
    }
    if (!(await status(root, state))) return 1;
  } else if (command === 'down') {
    if (state.mode === 'portable') await downPortable(root, state);
    else if (state.mode === 'docker') compose(root, state, ['stop']);
    else
      console.log(
        'No managed processes to stop. Existing servers are left running.',
      );
  } else if (command === 'logs') {
    const settings = readEnv(root);
    if (state.mode === 'docker')
      console.log(
        redact(compose(root, state, ['logs', '--tail', '100']), settings),
      );
    else {
      const logs = path.join(root, '.local-stack/logs');
      if (fs.existsSync(logs)) {
        for (const name of fs.readdirSync(logs))
          if (name.endsWith('.log'))
            console.log(
              `${name}\n${redact(fs.readFileSync(path.join(logs, name), 'utf8').split(/\r?\n/).slice(-80).join('\n'), settings)}`,
            );
      } else console.log('No managed logs yet.');
    }
  }
  return 0;
}
if (
  process.argv[1] &&
  path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)
) {
  main()
    .then((code) => {
      process.exitCode = code;
    })
    .catch((error) => {
      console.error(
        'Stack failed: ' +
          redact(error.message, {
            ...readEnv(path.resolve(process.env.WEBGIS_APP_DIR || '.')),
            ...process.env,
          }),
      );
      process.exitCode = 1;
    });
}
