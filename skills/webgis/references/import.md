# Import files

Run from the project: `npm run import -- <file-or-dir>...`. Use `--instance` or `WEBGIS_APP_DIR` for an external instance. Supported inputs are GeoJSON, all vector layers in a GeoPackage (`file.gpkg:layer` selects one), Shapefile plus its sidecars, and nonrecursive directories. Python 3.10+ is required; GDAL is found through `WEBGIS_OGR2OGR`, PATH, Windows QGIS or an already available Docker GDAL image.

Start with `--dry-run` for many/large inputs. It prints local recognition, SQL, password-free manifest and config diff, without network or file writes. Missing CRS is an explicit EPSG:4326 assumption; resolve uncertain source CRS before loading. Native PostGIS imports retain EPSG:7801 and other declared CRSs; local GeoJSON is transformed to EPSG:4326.

`--target postgis` requires the server settings in `.env`; it is selected automatically for a configured stack. Otherwise target is `geojson`. On a shared server always use the task's dedicated `--schema` and GeoServer service workspace. The safe default `--mode fail` refuses collisions. `append` checks compatibility; `replace` is explicit and retains old/staging tables. Do not use these modes to overwrite data outside the task's authority.

The command adds layers, identify/table support, fields, extents and palette styles. `--search auto|none|name,code`, `--filter auto|none`, and `--section "Data"` control generated blocks. Auto search uses name/code-like text fields; auto filters use numeric ranges and text fields with at most 50 distinct values. Cyrillic filenames/fields get ASCII resource names while retaining their labels.

Then run `npm run validate` and `npm run smoke`, start the map and verify the imported behavior. After bootstrap, read `<project>/docs/import.md` for environment keys, atomic config rollback, retained audit files and append/replace semantics; that file belongs to the checkout, not the installed skill folder.
