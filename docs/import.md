# Import vector data

Run `npm run import -- <file-or-dir>...` from the project. Python 3.10+ is required. GeoJSON needs no Python packages; GeoPackage and Shapefile use GDAL (`WEBGIS_OGR2OGR`, PATH, Windows QGIS, then Docker). Directory discovery is nonrecursive. Use `file.gpkg:layer` to select one GeoPackage layer.

```sh
npm run import -- ./data --target geojson --dry-run
npm run import -- ./data --target geojson
npm run import -- ./survey.gpkg --target postgis --schema survey --prefix survey_
```

The default target is PostGIS when server settings or a server stack are configured, otherwise local GeoJSON. Set `--instance <dir>` or `WEBGIS_APP_DIR` for an external instance. `--schema` defaults to `public`; choose a dedicated schema on a shared server. GeoJSON is copied/reprojected to EPSG:4326 for the browser. PostGIS tables preserve the source EPSG CRS, get a primary key, a GiST geometry index and statistics. Missing CRS is reported as an EPSG:4326 assumption; supply correctly declared source data before importing.

Names become unique lowercase ASCII identifiers, including transliteration of Cyrillic names. Original field names remain the labels. Technical keys are hidden in popups/tables. Each layer gets identify, a table, an extent and a legend; name/code fields get search and low-cardinality text/numeric fields get filters. Override with `--search none`, `--search name,code`, `--filter none` or `--section "Survey"`.

GeoPackage primary-key columns follow the same name normalization as other fields and retain their original values, including nonsequential IDs. Appended rows receive new unique database keys; compatible GDAL `varchar`/`text` and integer-width variants are accepted. Mixing integer and floating-point column types is refused to prevent silent rounding.

New PostGIS text columns use `pg_catalog."und-x-icu"` when that Unicode collation is available. This makes Cyrillic case-insensitive GeoServer queries work even when the database was initialized with a `C` locale. Database/server defaults and existing target columns are never changed. Without ICU the database's own case rules remain in effect and import reports that limitation; local GeoJSON/WFS-vector searches can use the browser's Unicode matching. Dry-run does not query server collations.

Existing app keys and unrelated layers/blocks are retained. Configuration is written atomically and restored if validation fails. The input data is never modified. An import audit, SQL, password-free publication manifest and SLD are retained under the instance's ignored `.webgis/imports/` directory. Database loading/publication happens before config validation; a failed config validation leaves those imported resources available for inspection and retry.

`--mode fail` is the safe default: existing table/layer/file collisions are refused before writing. `append` checks table columns, types and CRS, generates new primary keys, and inserts in a transaction. `replace` loads a staging table, then renames the old and new tables in one transaction. Backups and staging tables are retained; no table is dropped. Use an explicit prefix or a separate schema for independent datasets.

For PostGIS, fill the instance `.env` (it overrides the project `.env`; process environment has highest priority): `WEBGIS_DB_HOST`, `WEBGIS_DB_PORT`, `WEBGIS_DB_NAME`, `WEBGIS_DB_USER`, `WEBGIS_DB_PASSWORD`, `GEOSERVER_URL` (full base URL, including `/geoserver`), `GEOSERVER_USER`, `GEOSERVER_PASSWORD`. Set `WEBGIS_PSQL` when `psql` is not on PATH. A managed Docker stack can run psql inside its database container. The first configured GeoServer service supplies the workspace; without one, import adds `main` with workspace `webgis`. Use a different workspace in the instance config when sharing a server. Credentials are sent only to the configured services; they are never written to the manifest or command arguments.

`--dry-run` performs local inspection and prints SQL, a publication manifest and a configuration diff without network access or file writes. Vector conversion may run local GDAL; no database/GeoServer request is made. After importing, run `npm run validate`, `npm run smoke`, and `npm run dev` to inspect the map. Production hosting needs the [reverse proxy setup](deployment.md).
