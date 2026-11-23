# Local server architecture

`npm run stack -- up --mode <mode>` selects and records a mode in the ignored `.webgis/project.json`. Use `status`, `env`, `logs`, and `down` to inspect, troubleshoot and stop it. `--instance <dir>` selects an external instance/project; otherwise commands operate in the current project (or `WEBGIS_APP_DIR`). `env` reports only set/missing flags. `down` never removes databases, containers, volumes, runtime files or credentials.

| Mode       | Use                                                                                                                                                                                                                                             |
| ---------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `none`     | Local GeoJSON with no server. Import with `--target geojson`.                                                                                                                                                                                   |
| `existing` | Existing PostGIS and/or GeoServer. First `up` writes empty credential placeholders to `.env`; fill them yourself, then run `status`. Missing services/settings are reported separately. No existing server is started, stopped or reconfigured. |
| `portable` | Windows x64 without administrator rights or Docker. Creates a separate PostGIS/GeoServer installation under `.local-stack/`.                                                                                                                    |
| `docker`   | Docker Compose with PostgreSQL 17/PostGIS 3.7 and the official GeoServer 3.0.2 image. Creates a separate Compose project and named volumes.                                                                                                     |

New managed stacks generate independent random database, superuser and GeoServer passwords in ignored `.env`. Use a new project to switch between managed modes; server credentials are never silently adopted from an existing connection. Keep this file private. Supply `WEBGIS_PSQL` when an existing native psql is not on PATH. Existing-server status checks `postgis_full_version()` and authenticated GeoServer REST `about/version`; missing credentials produce instructions without prompting or printing values.

## Windows portable setup

```sh
npm run stack -- up --mode portable
npm run stack -- status
npm run import -- ./data --target postgis
npm run stack -- down
```

Use `--downloads <dir>` to reuse official ZIP archives without downloading. Accepted files are pinned Temurin JDK 21.0.13+9 (also `jdk21.zip`), GeoServer 3.0.2 binary ZIP, PostgreSQL 17.12 Windows binaries (also `postgresql-17.12-binaries.zip`) and the PostGIS 3.7.0 bundle for pg17. Hashes of every copied/downloaded archive are recorded in `.local-stack/downloads/SHA256SUMS`. The JDK checksum is pinned from the publisher; a supplied `SHA256SUMS` is also checked. The other vendors do not consistently publish SHA-256 alongside their Windows ZIPs; their recorded hashes identify the actual archive, rather than claiming publisher authentication. The archive catalog links to the publishers and the Adoptium metadata API.

The stack binds to localhost and selects free ports, starting with PostgreSQL 5433 and GeoServer 8080. Initialization uses SCRAM, a dedicated application role/database, PostGIS, and a temporary password file written through `.NET WriteAllText` and emptied afterwards. GeoServer uses an isolated copied data directory, a hidden long-lived launcher, explicit Java temporary paths and its own stop key/port. The initial default GeoServer password is changed through REST only for this newly created data directory and verified with the generated password. No administrator rights or Windows services are needed.

Runtime/license files, data and logs remain under `.local-stack/`; rerunning `up` reuses them. Native portable mode is not supported on macOS/Linux: use existing servers, Docker or local GeoJSON. The manual [Windows recipe](recipes/windows-portable-geoserver.md) explains the Java temporary-path and PowerShell argument constraints.

The pg17 PostGIS ZIP includes a curl DLL with a missing HTTP/2 dependency. Installation uses the complete curl variant already shipped in that ZIP's `postgisgui` folder, retaining the original as `libcurl-with-http2.dll`. This keeps native loading self-contained without relying on QGIS/Git/system DLL paths. PostgreSQL starts with its own bin directory on PATH and detached startup pipes; logs go to `.local-stack/logs`.

## Docker

The checked-in `stack/docker-compose.yml` binds ports only on `127.0.0.1`. PostgreSQL initializes a separate application role/database; GeoServer receives the generated admin password through its supported environment variable. Import uses the container's `db` host for GeoServer's datastore and localhost/container psql as appropriate. `up` waits for database health and authenticated GeoServer readiness; `down` uses Compose `stop`, retaining named volumes. A separate Actions workflow exercises this path when Docker is available.

Sources: [Adoptium archive verification](https://github.com/adoptium/api.adoptium.net/blob/main/docs/cookbook.adoc), [PostgreSQL Windows binaries](https://www.postgresql.org/download/windows/), [PostGIS Windows bundles](https://postgis.net/documentation/getting_started/install_windows/released_versions/), [GeoServer binaries](https://geoserver.org/release/3.0.2/), [official Docker image](https://github.com/geoserver/docker), [user REST schema](https://github.com/geoserver/geoserver/blob/3.0.2/doc/en/api/1.0.0/usergroup.yaml).
