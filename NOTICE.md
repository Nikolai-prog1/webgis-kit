# Third-party notices

WebGIS Kit is MIT licensed. OpenLayers, proj4, Inter and Tabler assets are installed from npm and bundled locally. The following notice files preserve the production dependency tree's copyright and license texts; not every optional format decoder is included in the application bundle. Distribution builds include these notices under `licenses/`.

## Dependencies

| Package                 | Version      | License              | Text                                                      |
| ----------------------- | ------------ | -------------------- | --------------------------------------------------------- |
| @fontsource/inter       | 5.3.0        | OFL-1.1              | [notice](docs/licenses/fontsource-inter-5.3.0.txt)        |
| @petamoriken/float16    | 3.9.3        | MIT                  | [notice](docs/licenses/petamoriken-float16-3.9.3.txt)     |
| @tabler/icons           | 3.52.0       | MIT                  | [notice](docs/licenses/tabler-icons-3.52.0.txt)           |
| @tabler/icons-webfont   | 3.52.0       | MIT                  | [notice](docs/licenses/tabler-icons-webfont-3.52.0.txt)   |
| @types/rbush            | 4.0.0        | MIT                  | [notice](docs/licenses/types-rbush-4.0.0.txt)             |
| @zarrita/storage        | 0.2.1        | MIT                  | [notice](docs/licenses/zarrita-storage-0.2.1.txt)         |
| earcut                  | 3.2.4        | ISC                  | [notice](docs/licenses/earcut-3.2.4.txt)                  |
| fflate                  | 0.8.3        | MIT                  | [notice](docs/licenses/fflate-0.8.3.txt)                  |
| geotiff                 | 3.1.0-beta.0 | MIT                  | [notice](docs/licenses/geotiff-3.1.0-beta.0.txt)          |
| lerc                    | 3.0.0        | Apache-2.0           | [notice](docs/licenses/lerc-3.0.0.txt)                    |
| mgrs                    | 1.0.0        | MIT                  | [notice](docs/licenses/mgrs-1.0.0.txt)                    |
| numcodecs               | 0.3.2        | MIT                  | [notice](docs/licenses/numcodecs-0.3.2.txt)               |
| ol                      | 10.11.0      | BSD-2-Clause         | [notice](docs/licenses/ol-10.11.0.txt)                    |
| pako                    | 2.2.0        | (MIT AND Zlib)       | [notice](docs/licenses/pako-2.2.0.txt)                    |
| parse-headers           | 2.0.6        | MIT                  | [notice](docs/licenses/parse-headers-2.0.6.txt)           |
| pbf                     | 5.1.2        | BSD-3-Clause         | [notice](docs/licenses/pbf-5.1.2.txt)                     |
| proj4                   | 2.23.0       | MIT                  | [notice](docs/licenses/proj4-2.23.0.txt)                  |
| protocol-buffers-schema | 3.6.1        | MIT                  | [notice](docs/licenses/protocol-buffers-schema-3.6.1.txt) |
| quick-lru               | 6.1.2        | MIT                  | [notice](docs/licenses/quick-lru-6.1.2.txt)               |
| quickselect             | 3.0.0        | ISC                  | [notice](docs/licenses/quickselect-3.0.0.txt)             |
| rbush                   | 4.0.1        | MIT                  | [notice](docs/licenses/rbush-4.0.1.txt)                   |
| reference-spec-reader   | 0.2.0        | MIT                  | [notice](docs/licenses/reference-spec-reader-0.2.0.txt)   |
| resolve-protobuf-schema | 2.1.0        | MIT                  | [notice](docs/licenses/resolve-protobuf-schema-2.1.0.txt) |
| unzipit                 | 2.1.1        | MIT                  | [notice](docs/licenses/unzipit-2.1.1.txt)                 |
| web-worker              | 1.5.0        | Apache-2.0           | [notice](docs/licenses/web-worker-1.5.0.txt)              |
| wkt-parser              | 1.9.0        | MIT                  | [notice](docs/licenses/wkt-parser-1.9.0.txt)              |
| xml-utils               | 1.10.2       | CC0-1.0              | [notice](docs/licenses/xml-utils-1.10.2.txt)              |
| zarrita                 | 0.7.6        | MIT                  | [notice](docs/licenses/zarrita-0.7.6.txt)                 |
| zstddec                 | 0.2.0        | MIT AND BSD-3-Clause | [notice](docs/licenses/zstddec-0.2.0.txt)                 |

## Data and maps

The committed cities, rivers and simplified countries come from Natural Earth 1:110m, release v5.1.2, in the public domain. Source fields were reduced and country geometry simplified. See [Natural Earth terms](https://www.naturalearthdata.com/about/terms-of-use/) and the dataset metadata. Synthetic fallback generation is available explicitly in the demo-data tool.

OpenStreetMap data is ODbL; its public tile service has a separate [usage policy](https://operations.osmfoundation.org/policies/tiles/). Preserve the visible credit supplied by the OpenLayers OSM source.

The optional 2016 EOX basemap is CC BY 4.0. Its complete credit is in the demo configuration and is included in map exports. The provider's [FAQ](https://cloudless.eox.at/documentation/faq) describes permitted use and service limits. The optional public WMS is subject to [terrestris terms](https://terrestris.de/produkte/freier-osm-wms/). Neither service is required to load the demo.

The kit's small SVG brand and synthetic fixtures were created for this template; they contain no external imagery.
