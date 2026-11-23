# Portable GeoServer and PostGIS on Windows

This recipe runs a dedicated localhost lab under `%USERPROFILE%\webgis-test` without installing Windows services or changing machine-wide environment variables. Use a new data directory; keep an existing server's security and database settings intact.

## Portable packages

Download a Windows x64 [Temurin 21 ZIP](https://adoptium.net/installation/archives), the [GeoServer Platform Independent Binary](https://geoserver.org/download/), [PostgreSQL Windows binaries](https://www.postgresql.org/download/windows/), and the matching [PostGIS Windows bundle](https://postgis.net/documentation/getting_started/install_windows/). Match the PostGIS bundle to the PostgreSQL major version and architecture. GeoServer 3.0 supports Java 21; check the [Java compatibility table](https://docs.geoserver.org/main/en/user/production/java/) when selecting another release.

Extract them into `runtime\jdk`, `runtime\geoserver`, and `runtime\pgsql` in the lab. Overlay the matching PostGIS bundle into the PostgreSQL binary tree, preserving its `bin`, `lib` and `share` structure. Keep local credentials in a private settings file outside the Kit checkout.

```powershell
$TestRoot = Join-Path $env:USERPROFILE 'webgis-test'
$PgBin = Join-Path $TestRoot 'runtime\pgsql\bin'
$PgData = Join-Path $TestRoot 'data\pgdata'
New-Item -ItemType Directory -Force "$TestRoot\data", "$TestRoot\logs", "$TestRoot\tmp", "$TestRoot\work", "$TestRoot\scripts" | Out-Null
```

## PostgreSQL on a separate loopback port

Initialize only a new cluster. `--pwprompt` reads the new lab administrator's credential interactively, without placing it in a command or log:

```powershell
& "$PgBin\initdb.exe" -D $PgData --username=postgres --auth-host=scram-sha-256 --auth-local=scram-sha-256 --pwprompt
```

Set `port = 5433` and `listen_addresses = 'localhost'` in this new cluster's `postgresql.conf`. Run it as the current user:

```powershell
& "$PgBin\pg_ctl.exe" -D $PgData -l "$TestRoot\logs\postgres.log" -w start
```

Using `psql`, create a lab role `webgis` with login and set its credential using `\password webgis`. Create database `webgis` owned by that role. As the cluster administrator, enable PostGIS once in that database with `CREATE EXTENSION IF NOT EXISTS postgis;`. The seed then uses the dedicated role and never drops or truncates tables.

## GeoServer launcher and Windows argument handling

For a new lab, copy the distribution's default `data_dir` to `data\geoserver_data` once and set `GEOSERVER_DATA_DIR` to that copy. Leave an existing data directory alone.

Save the following as `scripts\run-geoserver.cmd`, adjusting the extracted JDK directory if necessary:

```bat
@echo off
set "TEST_ROOT=%~dp0.."
set "JAVA_HOME=%TEST_ROOT%\runtime\jdk"
set "GEOSERVER_HOME=%TEST_ROOT%\runtime\geoserver"
set "GEOSERVER_DATA_DIR=%TEST_ROOT%\data\geoserver_data"
cd /d "%GEOSERVER_HOME%"
"%JAVA_HOME%\bin\java.exe" -Xms256m -Xmx1g "-Djdk.net.unixdomain.tmpdir=%TEST_ROOT%\tmp" "-Djava.io.tmpdir=%TEST_ROOT%\tmp" "-DGEOSERVER_DATA_DIR=%GEOSERVER_DATA_DIR%" -jar start.jar jetty.http.host=127.0.0.1 jetty.http.port=8080 >> "%TEST_ROOT%\logs\geoserver.log" 2>&1
```

Two Windows-specific details matter here. On affected machines, Java's internal loopback channel cannot use a temporary path containing an 8.3 short directory name; the two quoted `-D` properties select the lab's full-name temporary directory. PowerShell 5.1 can split dotted native arguments incorrectly, so run Java through the `.cmd` launcher and pass host/port as Jetty properties. These workarounds concern launching Java, not GeoServer authentication.

Start the launcher as a retained process, with a hidden helper window:

```powershell
$GeoServerLauncher = Start-Process -FilePath "$TestRoot\scripts\run-geoserver.cmd" -WindowStyle Hidden -PassThru
Invoke-WebRequest 'http://127.0.0.1:8080/geoserver/wms?service=WMS&request=GetCapabilities'
```

Allow startup time and inspect the end of `logs\geoserver.log` if readiness fails. See the [GeoServer binary guide](https://docs.geoserver.org/stable/en/user/installation/win_binary/) for the distribution's launch and shutdown options. Retain the lab's process identifiers when using a custom launcher; stop only that lab's Java process. PostgreSQL stops cleanly with `pg_ctl.exe -D $PgData -m fast -w stop`. Stopping the lab does not require deleting its data.

## Seed and frontend without Docker

Load the dedicated role's `PGPASSWORD`, the publisher's `GEOSERVER_USER` / `GEOSERVER_PASSWORD`, and `POSTGRES_PASSWORD` for the GeoServer store from your private local settings. Do not print these values or add them to Git. From the Kit checkout:

```powershell
python examples/geoserver-stack/seed.py --psql "$PgBin\psql.exe" --db-host localhost --db-port 5433 --output-dir "$TestRoot\work\seed" --url http://127.0.0.1:8080/geoserver
$env:GEOSERVER_URL = 'http://127.0.0.1:8080'
$env:WEBGIS_APP_DIR = 'examples/configs/geoserver-full'
npm ci --include=dev
npm run dev
```

Preview the plan first by adding `--dry-run`; it executes no database or server requests. Native psql receives the credential through its environment and has prompting disabled. Generated SQL, styles and manifests go to `--output-dir`; repeating the seed upserts the same identifiers.

The full example includes three WMS layers, WFS search/filter/table queries and a workspace capabilities catalog. GeoServer's workspace is `demo`. The opt-in live acceptance suite uses `WEBGIS_LIVE_GEOSERVER=1` and `GEOSERVER_URL` (the origin without `/geoserver`); it is excluded from the ordinary check and CI. This recipe describes setup; a machine's installed runtime and filesystem permissions still need their own verification.
