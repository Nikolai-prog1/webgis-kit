import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { pipeline } from 'node:stream/promises';
import { Readable } from 'node:stream';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import {
  readEnv,
  saveEnv,
  saveMetadata,
  secret,
  run,
  freePort,
  http,
  waitFor,
} from './common.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));
const catalog = JSON.parse(
  fs.readFileSync(path.join(here, 'downloads.json'), 'utf8'),
);
export async function hash(file) {
  const digest = crypto.createHash('sha256');
  for await (const chunk of fs.createReadStream(file)) digest.update(chunk);
  return digest.digest('hex');
}
export function checksumExpectation(publisher, supplied) {
  if (supplied && !/^[0-9a-f]{64}$/i.test(supplied))
    throw new Error('Expected a SHA-256 checksum.');
  if (
    publisher &&
    supplied &&
    publisher.toLowerCase() !== supplied.toLowerCase()
  )
    throw new Error(
      'Supplied checksum conflicts with the pinned publisher checksum.',
    );
  return publisher || supplied;
}
export function launcher() {
  return '@echo off\r\nchcp 65001 >nul\r\nsetlocal DisableDelayedExpansion\r\ncd /d "%WEBGIS_GS_HOME%"\r\n"%WEBGIS_JAVA%" -Xms256m -Xmx1g "-Djdk.net.unixdomain.tmpdir=%WEBGIS_TMP%" "-Djava.io.tmpdir=%WEBGIS_TMP%" "-DGEOSERVER_DATA_DIR=%GEOSERVER_DATA_DIR%" "-DSTOP.PORT=%WEBGIS_STOP_PORT%" "-DSTOP.KEY=%WEBGIS_STOP_KEY%" -jar start.jar jetty.http.host=127.0.0.1 "jetty.http.port=%WEBGIS_GS_PORT%" >> "%WEBGIS_GS_LOG%" 2>&1\r\n';
}
export function preparePortableLibraries(bin) {
  const bundled = path.join(bin, 'libcurl.dll'),
    complete = path.join(bin, 'postgisgui/libcurl.dll');
  const backup = path.join(bin, 'libcurl-with-http2.dll');
  // This pg17 bundle includes a curl build whose HTTP/2 dependency is absent,
  // plus a self-contained curl build in its GUI folder. Use the latter from
  // the same verified archive, retaining the original, without borrowing
  // third-party libraries from another installed application.
  if (
    !fs.existsSync(path.join(bin, 'libnghttp2-14.dll')) &&
    fs.existsSync(complete) &&
    !fs.existsSync(backup)
  ) {
    fs.copyFileSync(bundled, backup);
    fs.copyFileSync(complete, bundled);
  }
}
async function archives(root, source) {
  const directory = path.join(root, '.local-stack/downloads');
  fs.mkdirSync(directory, { recursive: true });
  const results = {},
    sums = [];
  for (const asset of catalog) {
    const target = path.join(directory, asset.name);
    let expected = asset.sha256;
    if (!fs.existsSync(target)) {
      if (source) {
        const original = [asset.name, ...(asset.aliases || [])]
          .map((name) => path.join(source, name))
          .find((file) => fs.existsSync(file));
        if (!original)
          throw new Error(
            `Offline downloads are missing ${asset.name}. No runtime was downloaded.`,
          );
        fs.copyFileSync(original, target);
        const sumFile = path.join(source, 'SHA256SUMS');
        if (fs.existsSync(sumFile)) {
          const line = fs
            .readFileSync(sumFile, 'utf8')
            .split(/\r?\n/)
            .find((line) => line.endsWith(path.basename(original)));
          if (line)
            expected = checksumExpectation(asset.sha256, line.split(/\s+/)[0]);
        }
      } else {
        let url = asset.url;
        if (asset.metadataUrl)
          try {
            const response = await fetch(asset.metadataUrl, {
              signal: AbortSignal.timeout(20000),
            });
            if (response.ok) {
              const entries = await response.json();
              const data = entries[0]?.binaries?.[0]?.package;
              if (data?.checksum && data.link) {
                expected = data.checksum;
                url = data.link;
              }
            }
          } catch {
            /* the pinned publisher checksum remains available */
          }
        console.log(`Downloading ${asset.name}`);
        const response = await fetch(url, {
          signal: AbortSignal.timeout(600000),
        });
        if (!response.ok)
          throw new Error(
            `Download failed (${response.status}) for ${asset.name}. Use --downloads with official archives.`,
          );
        await pipeline(
          Readable.fromWeb(response.body),
          fs.createWriteStream(target),
        );
      }
    }
    const digest = await hash(target);
    if (expected && digest.toLowerCase() !== expected.toLowerCase())
      throw new Error(
        `SHA-256 verification failed for ${asset.name}; archive retained for inspection.`,
      );
    sums.push(`${digest}  ${asset.name}`);
    results[asset.id] = target;
    console.log(
      `${asset.name}: SHA-256 recorded${expected ? ' and verified against the supplied/publisher checksum' : ' (publisher SHA-256 not bundled)'}.`,
    );
  }
  fs.writeFileSync(path.join(directory, 'SHA256SUMS'), sums.join('\n') + '\n');
  return results;
}
function powershell(file, args, env) {
  return run(
    'powershell.exe',
    [
      '-NoProfile',
      '-ExecutionPolicy',
      'Bypass',
      '-File',
      path.join(here, file),
      ...args,
    ],
    { env },
  );
}
function runtime(root) {
  const home = path.join(root, '.local-stack');
  const runtime = path.join(home, 'runtime');
  const jdk = path.join(runtime, 'jdk');
  const java = fs.existsSync(jdk)
    ? fs
        .readdirSync(jdk)
        .map((name) => path.join(jdk, name, 'bin/java.exe'))
        .find((file) => fs.existsSync(file))
    : null;
  return {
    home,
    runtime,
    java,
    pg: path.join(runtime, 'pgsql/bin'),
    gs: path.join(runtime, 'geoserver'),
    pgdata: path.join(home, 'data/pgdata'),
    gsdata: path.join(home, 'data/geoserver'),
    tmp: path.join(home, 'tmp'),
    logs: path.join(home, 'logs'),
  };
}
export function portableEnvironment(root, state, settings = readEnv(root)) {
  const files = runtime(root);
  return {
    ...process.env,
    ...settings,
    PATH: files.pg + path.delimiter + (process.env.PATH || ''),
    JAVA_HOME: path.dirname(path.dirname(files.java)),
    GEOSERVER_HOME: files.gs,
    GEOSERVER_DATA_DIR: files.gsdata,
    WEBGIS_GS_HOME: files.gs,
    WEBGIS_JAVA: files.java,
    WEBGIS_TMP: files.tmp,
    WEBGIS_STOP_PORT: String(state.stopPort),
    WEBGIS_GS_PORT: String(state.gsPort),
    WEBGIS_GS_LOG: path.join(files.logs, 'geoserver.log'),
    PGCLIENTENCODING: 'UTF8',
  };
}
function pg(root, settings, sql, superuser = false, database) {
  const files = runtime(root);
  return run(
    path.join(files.pg, 'psql.exe'),
    [
      '-h',
      'localhost',
      '-p',
      settings.WEBGIS_DB_PORT,
      '-U',
      superuser ? 'postgres' : settings.WEBGIS_DB_USER,
      '-d',
      database || settings.WEBGIS_DB_NAME,
      '--no-password',
      '-X',
      '-q',
      '-t',
      '-A',
      '-v',
      'ON_ERROR_STOP=1',
    ],
    {
      env: {
        ...process.env,
        ...settings,
        PGPASSWORD: superuser
          ? settings.PG_SUPERUSER_PASSWORD
          : settings.WEBGIS_DB_PASSWORD,
        PGCLIENTENCODING: 'UTF8',
      },
      input: sql,
    },
  );
}
export async function upPortable(root, state, options = {}) {
  if (process.platform !== 'win32')
    throw new Error(
      'Portable mode supports Windows x64. Use docker, existing or none on this platform.',
    );
  if (process.arch !== 'x64')
    throw new Error('The portable runtime bundle requires Windows x64.');
  let files = runtime(root);
  for (const dir of [
    files.home,
    files.runtime,
    files.tmp,
    files.logs,
    path.dirname(files.pgdata),
  ])
    fs.mkdirSync(dir, { recursive: true });
  const marker = path.join(files.runtime, 'READY.json');
  if (!fs.existsSync(marker)) {
    const downloaded = await archives(root, options.downloads);
    for (const [id, directory] of [
      ['jdk', path.join(files.runtime, 'jdk')],
      ['geoserver', files.gs],
      ['postgresql', files.runtime],
      ['postgis', path.join(files.runtime, 'postgis')],
    ]) {
      console.log(`Extracting ${id}`);
      powershell(
        'extract.ps1',
        ['-Archive', downloaded[id], '-Destination', directory, '-Kind', id],
        process.env,
      );
    }
    const postgisRoot = fs
      .readdirSync(path.join(files.runtime, 'postgis'))
      .map((name) => path.join(files.runtime, 'postgis', name))
      .find((dir) =>
        fs.existsSync(path.join(dir, 'share/extension/postgis.control')),
      );
    if (!postgisRoot)
      throw new Error('PostGIS bundle does not contain its extension files.');
    for (const part of ['bin', 'lib', 'share'])
      fs.cpSync(
        path.join(postgisRoot, part),
        path.join(files.runtime, 'pgsql', part),
        { recursive: true },
      );
    fs.writeFileSync(
      marker,
      JSON.stringify({
        versions: {
          java: '21.0.13+9',
          geoserver: '3.0.2',
          postgresql: '17.12',
          postgis: '3.7.0',
        },
      }) + '\n',
    );
    files = runtime(root);
  }
  preparePortableLibraries(files.pg);
  for (const library of [
    'msvcp140.dll',
    'vcruntime140.dll',
    'vcruntime140_1.dll',
  ]) {
    const bundled = path.join(path.dirname(files.java), library),
      target = path.join(files.pg, library);
    if (!fs.existsSync(target) && fs.existsSync(bundled))
      fs.copyFileSync(bundled, target);
  }
  const old = readEnv(root);
  const first = !state.portable;
  if (
    first &&
    ['GEOSERVER_PASSWORD', 'WEBGIS_DB_PASSWORD', 'PG_SUPERUSER_PASSWORD'].some(
      (key) => old[key],
    )
  )
    throw new Error(
      'Use a new project for a new portable stack; existing server credentials are retained.',
    );
  const pgRunning =
    fs.existsSync(path.join(files.pgdata, 'PG_VERSION')) &&
    spawnSync(
      path.join(files.pg, 'pg_ctl.exe'),
      ['-D', files.pgdata, 'status'],
      { windowsHide: true, stdio: 'ignore' },
    ).status === 0;
  const pgPort = pgRunning
    ? state.pgPort
    : await freePort(state.pgPort || 5433);
  const gsPort = state.gsPort || (await freePort(8080, [pgPort]));
  const stopPort = state.stopPort || (await freePort(8079, [pgPort, gsPort]));
  const settings = {
    ...old,
    WEBGIS_DB_HOST: 'localhost',
    WEBGIS_DB_PORT: String(pgPort),
    WEBGIS_DB_NAME: old.WEBGIS_DB_NAME || 'webgis',
    WEBGIS_DB_USER: old.WEBGIS_DB_USER || 'webgis',
    WEBGIS_DB_PASSWORD: old.WEBGIS_DB_PASSWORD || secret(),
    PG_SUPERUSER_PASSWORD: old.PG_SUPERUSER_PASSWORD || secret(),
    GEOSERVER_URL: `http://127.0.0.1:${gsPort}/geoserver`,
    GEOSERVER_USER: 'admin',
    GEOSERVER_PASSWORD: old.GEOSERVER_PASSWORD || secret(),
    WEBGIS_STOP_KEY: old.WEBGIS_STOP_KEY || secret(),
    WEBGIS_PSQL: path.join(files.pg, 'psql.exe'),
  };
  for (const key of ['WEBGIS_DB_NAME', 'WEBGIS_DB_USER'])
    if (!/^[a-z_][a-z0-9_]*$/.test(settings[key]))
      throw new Error(`${key} needs an ASCII SQL identifier.`);
  saveEnv(root, settings);
  Object.assign(state, {
    mode: 'portable',
    portable: true,
    pgPort,
    gsPort,
    stopPort,
  });
  saveMetadata(root, state);
  const environment = portableEnvironment(root, state, settings);
  if (!fs.existsSync(path.join(files.pgdata, 'PG_VERSION'))) {
    console.log('Initializing the isolated PostgreSQL cluster');
    const output = powershell(
      'init-postgres.ps1',
      [
        '-Initdb',
        path.join(files.pg, 'initdb.exe'),
        '-Data',
        files.pgdata,
        '-PasswordFile',
        path.join(files.tmp, 'initdb.pw'),
      ],
      environment,
    );
    fs.writeFileSync(path.join(files.logs, 'initdb.log'), output + '\n');
  }
  if (!pgRunning) {
    fs.appendFileSync(
      path.join(files.pgdata, 'postgresql.conf'),
      `\nlisten_addresses = 'localhost'\nport = ${pgPort}\n`,
    );
    run(
      path.join(files.pg, 'pg_ctl.exe'),
      [
        '-D',
        files.pgdata,
        '-l',
        path.join(files.logs, 'postgres.log'),
        '-w',
        '-t',
        '60',
        'start',
      ],
      // On Windows postmaster inherits pg_ctl's pipe handles even after pg_ctl
      // exits. Use the explicit PostgreSQL log and no captured startup pipes.
      { env: environment, stdio: 'ignore' },
    );
  }
  const role = settings.WEBGIS_DB_USER,
    database = settings.WEBGIS_DB_NAME;
  if (
    pg(
      root,
      settings,
      `SELECT 1 FROM pg_roles WHERE rolname='${role}';`,
      true,
      'postgres',
    ) !== '1'
  )
    pg(
      root,
      settings,
      `CREATE ROLE "${role}" LOGIN PASSWORD '${settings.WEBGIS_DB_PASSWORD}';`,
      true,
      'postgres',
    );
  if (
    pg(
      root,
      settings,
      `SELECT 1 FROM pg_database WHERE datname='${database}';`,
      true,
      'postgres',
    ) !== '1'
  )
    pg(
      root,
      settings,
      `CREATE DATABASE "${database}" OWNER "${role}";`,
      true,
      'postgres',
    );
  pg(root, settings, 'CREATE EXTENSION IF NOT EXISTS postgis;', true, database);
  if (!fs.existsSync(path.join(files.gsdata, 'global.xml')))
    fs.cpSync(path.join(files.gs, 'data_dir'), files.gsdata, {
      recursive: true,
    });
  let alreadyUp = false;
  try {
    alreadyUp = (
      await http(settings.GEOSERVER_URL + '/rest/about/version.json', settings)
    ).ok;
  } catch {
    /* start our own service */
  }
  if (!alreadyUp) {
    const file = path.join(files.home, 'run-geoserver.cmd');
    fs.writeFileSync(file, launcher());
    const pid = powershell(
      'start-geoserver.ps1',
      ['-Launcher', file],
      environment,
    );
    state.geoserverLauncherPid = Number(pid);
    saveMetadata(root, state);
    console.log(`Waiting for the new GeoServer on localhost:${gsPort}`);
    await waitFor(
      async () => {
        const response = await fetch(
          settings.GEOSERVER_URL + '/wms?service=WMS&request=GetCapabilities',
          { signal: AbortSignal.timeout(3000) },
        );
        return response.ok;
      },
      'GeoServer',
      180,
    );
    const current = await http(
      settings.GEOSERVER_URL + '/rest/about/version.json',
      settings,
    );
    if (!current.ok) {
      if (state.adminConfigured)
        throw new Error(
          'Saved GeoServer credentials did not authenticate; no password was changed.',
        );
      const response = await http(
        settings.GEOSERVER_URL + '/rest/security/usergroup/user/admin',
        { GEOSERVER_USER: 'admin', GEOSERVER_PASSWORD: 'geoserver' },
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/xml' },
          body: `<user><password>${settings.GEOSERVER_PASSWORD}</password></user>`,
        },
      );
      if (!response.ok)
        throw new Error(
          `Could not initialize the new GeoServer admin password (${response.status}).`,
        );
    }
  }
  const verified = await http(
    settings.GEOSERVER_URL + '/rest/about/version.json',
    settings,
  );
  if (!verified.ok) throw new Error('New GeoServer login verification failed.');
  state.adminConfigured = true;
  saveMetadata(root, state);
  console.log(
    `Portable stack ready: PostGIS localhost:${pgPort}; GeoServer localhost:${gsPort}. Credentials are in the ignored .env.`,
  );
  return settings;
}
export async function downPortable(root, state) {
  const files = runtime(root),
    settings = readEnv(root),
    environment = portableEnvironment(root, state, settings);
  try {
    run(
      files.java,
      [
        `-DSTOP.PORT=${state.stopPort}`,
        `-DSTOP.KEY=${settings.WEBGIS_STOP_KEY}`,
        '-jar',
        'start.jar',
        '--stop',
      ],
      { cwd: files.gs, env: environment },
    );
  } catch (error) {
    console.log(`GeoServer stop: ${error.message}`);
  }
  const running =
    spawnSync(
      path.join(files.pg, 'pg_ctl.exe'),
      ['-D', files.pgdata, 'status'],
      { windowsHide: true, stdio: 'ignore' },
    ).status === 0;
  if (running)
    run(
      path.join(files.pg, 'pg_ctl.exe'),
      ['-D', files.pgdata, '-m', 'fast', '-w', '-t', '60', 'stop'],
      { env: environment },
    );
  console.log(
    'Portable stack stopped. Runtime, databases and files are retained.',
  );
}
