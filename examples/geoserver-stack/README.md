# Optional local GeoServer stack

This example uses the official GeoServer image `docker.osgeo.org/geoserver:2.28.6` and the maintained PostGIS image `postgis/postgis:17-3.7`. Image names were checked against the projects' documentation. Container execution has not been verified on the development machine because Docker is unavailable.

Copy `.env.example` to `.env` here and fill the two credentials locally. Start this new, isolated demo database from this directory:

```sh
docker compose up -d
python seed.py
```

The seed script upserts the committed Natural Earth data using stable seed identifiers, creates spatial indexes, then publishes styles and layers through the generic publisher. It does not drop or truncate tables. GeoServer is exposed only on loopback port 8080. The database is reachable by the server as `db`. To review SQL, styles, manifest and planned HTTP operations without Docker or credentials, run `python seed.py --dry-run`.

From the repository root, select the matching frontend:

```powershell
$env:WEBGIS_APP_DIR = 'examples/configs/geoserver'
npm run dev
```

The frontend uses WMS to draw cities and WFS to search and page attributes. Runtime changes belong in its `static/config/app.json`. Named volumes retain this example's database and server configuration. Review container operations yourself when changing data volumes or image versions; the seed script is for this dedicated demo environment.

Sources: [GeoServer image](https://github.com/geoserver/docker), [GeoServer downloads](https://geoserver.org/download/), [PostGIS image](https://github.com/postgis/docker-postgis).

## Native database without Docker

Set `PGPASSWORD` for the selected database role and `GEOSERVER_USER` / `GEOSERVER_PASSWORD` for the local server, using an ignored local settings file or your session environment. Also set `POSTGRES_PASSWORD` for the published store when creating it. Run from the repository root, adjusting only your local executable path:

```powershell
python examples/geoserver-stack/seed.py --psql "$env:USERPROFILE\webgis-test\runtime\pgsql\bin\psql.exe" --db-host localhost --db-port 5433 --url http://127.0.0.1:8080/geoserver --output-dir .cache/native-seed
```

`--db-port` is written into the store manifest. `--psql` avoids Docker and passes the credential only through the child environment. `--output-dir` keeps generated SQL/styles/manifests outside source files. `--dry-run` still prepares the plan without executing psql, Docker or HTTP requests. See the [Windows portable recipe](../../docs/recipes/windows-portable-geoserver.md).
