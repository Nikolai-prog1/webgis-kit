# Coordinate systems

Any coordinate system the user names can be used in three places. Each is independent; do only what was asked.

| Need                               | How                                             |
| ---------------------------------- | ----------------------------------------------- |
| Data in any system                 | `npm run import` reprojects or keeps it (below) |
| Show/enter coordinates in a system | `npm run crs -- add <system>`                   |
| The map itself drawn in a system   | `npm run crs -- add <system> --map`             |

## Importing data in any system

The importer reads the system the data declare: GeoJSON `crs`, a Shapefile's `.prj`, a GeoPackage's registered system. With `--target geojson` everything becomes longitude/latitude (EPSG:4326). With PostGIS an EPSG-coded system is kept as the table's native system; GeoServer serves it and the map receives it in longitude/latitude. A system without an EPSG code (a local or historical grid, a custom `.prj`) is reprojected to EPSG:4326 through GDAL.

When data carry no declaration and their numbers are not longitude/latitude, the import stops and asks for the source system; never guess it. Pass it with `--srs`: an EPSG code (`--srs EPSG:7801`), a `.prj`/`.wkt` file (`--srs path/to/file.prj`) or a WKT/PROJ string. Ask the user which system the data are in when the file name, metadata or accompanying documents do not say. Reprojection needs GDAL (QGIS includes it; see [import](import.md)).

## Adding a system to the map

```sh
npm run crs -- add EPSG:7801                    # coordinate display and go-to
npm run crs -- add EPSG:32635 --map             # also draw the map in UTM 35N
npm run crs -- add data/grid.prj --code LOCAL:GRID --label "Local grid" --area <west>,<south>,<east>,<north>
npm run crs -- add "+proj=..." --code LOCAL:1 --area <west>,<south>,<east>,<north>
npm run crs -- list
```

The tool writes the `crs` entry (definition, bounds, label) and adds it to the status bar; the go-to and marker tools then accept and show it. It resolves systems offline for common European and Balkan grids and all UTM zones; other EPSG codes come from local GDAL (`gdalsrsinfo`, also found inside QGIS) or epsg.io. A system without an EPSG code needs `--code` (any `NAME:ID`) and `--area` (where it is valid, in degrees), unless GDAL knows its area. `--no-status` keeps it out of the status bar. The tool validates and restores the previous configuration on error.

With `--map` the view uses that projection. OpenStreetMap and other Web Mercator basemaps are reprojected in the browser (labels may look slightly distorted); WMS layers are requested in the map's projection, which GeoServer and QGIS Server support for any EPSG system. Local and WFS data are reprojected in the browser. Map centre, `extent` and `homeExtent` stay in longitude/latitude in every projection; `openAtHome` frames `homeExtent` on load, which is the reliable way to open a projected map on the data.

## Details

Map centre and geographic extents are longitude/latitude in EPSG:4326. Custom entries need `proj4` and, for coordinate input, `bbox` in the system's units; `worldBbox` is the area of use in degrees. Projected input is matched against each system's `bbox` before EPSG:3857, so overlapping systems are tried in their configured order. `axisOrder: "ne"` displays and reads northing first (customary for Bulgarian BGS2005 X/Y), with `axisLabels` such as `["X", "Y"]`; it does not change the proj4 definition.

[`examples/configs/bulgaria-crs`](../../../examples/configs/bulgaria-crs) is a complete EPSG:7801 instance. Test geographic input with decimal points and commas, explicit axis labels, hemisphere letters, both projected orders and values outside the bounds.
