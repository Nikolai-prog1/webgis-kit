# Coordinate systems

WebGIS Kit works with any coordinate reference system in three independent places:

- **Data.** `npm run import` reads the system declared by GeoJSON `crs`, a Shapefile `.prj` or a GeoPackage. Local GeoJSON output and systems without an EPSG code are reprojected to EPSG:4326 with GDAL; PostGIS keeps EPSG-coded systems as the native table system. Undeclared projected data are refused until `--srs EPSG:<code>` or `--srs <file.prj>` names the source, so coordinates are never silently misplaced.
- **Coordinate display and entry.** `npm run crs -- add EPSG:<code>` adds a system to the status bar, the go-to tool and markers. Systems without a code use `--code NAME:ID`, a `.prj` file or a PROJ string, and `--area west,south,east,north` in degrees.
- **Map projection.** `npm run crs -- add EPSG:<code> --map` (or `map.projection` in `app.json`) draws the map in that system. Web Mercator basemaps are reprojected in the browser; WMS layers are requested in the map projection. `map.center`, `map.extent` and `map.homeExtent` remain longitude/latitude; `map.openAtHome` fits `homeExtent` on load.

The tool resolves common European/Balkan systems and all UTM zones offline, other EPSG codes through GDAL's `gdalsrsinfo` (QGIS includes it) or epsg.io. See [the CRS reference](../skills/webgis/references/crs.md) and the complete [`bulgaria-crs`](../examples/configs/bulgaria-crs) example. Automated tests cover BGS2005 (EPSG:7801) as the map projection, coordinate entry and identify in it, and imports from declared, undeclared and EPSG-less `.prj` sources.
