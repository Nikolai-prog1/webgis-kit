# Changelog

This file follows Keep a Changelog. The initial release is 0.1.0.

## [0.2.2] - 2026-11-23

### Changed

- First public release. Installation notes no longer assume a private repository.

## [0.2.1] - 2026-11-17

### Fixed

- Docker stack: the PostGIS container could not read the bind-mounted init SQL (owner-only permissions on the host), exited during initialization and the stack never started. The application role is now created from WEBGIS_DB_PASSWORD in the container environment by a committed init script; no credential file is shared with the container. Verified end to end in the Stack integration workflow (stack up, import, smoke, browser test).

## [0.2.0] - 2026-11-17

### Added

- Bootstrap a versioned WebGIS project from an installed standalone skill, with a neutral bilingual starter and an opt-in retained Natural Earth demo.
- Import GeoJSON, GeoPackage and Shapefile into local GeoJSON or PostGIS/GeoServer with CRS preservation, Cyrillic resource-name transliteration, safe collision handling, atomic replacement/backups and generated map/search/filter/table controls.
- Manage existing, Windows portable, Docker and no-server architectures. Portable setup reuses verified offline archives, selects free localhost ports, generates credentials and retains data when stopped.
- Verify configured data and WMS/WFS services with the smoke command and optional Chromium screenshots; report HTTP-only verification when a browser is unavailable.
- Support the complete new-project agent workflow, project-local skill installation, synchronized release metadata, imported-layer live coverage and Docker stack CI.

### Fixed

- Add an accessible remove button to each finished distance/area measurement; remove its geometry, label and export annotation together without affecting other results or passing the click to active map tools.
- Cancel pending search, filter and identify requests on Clear map, ignore late query responses, clear result counts and close toolbar popovers.
- Remove map highlights and the popup when a search/filter result window is closed. Cover marker/coordinate removal and unfinished measurement cleanup in browser scenarios.

## [0.1.2] - 2026-11-17

### Fixed

- WFS 2.0 servers that only offer GML (MapServer's default configuration) now work for search, filters and attribute tables: the FES adapter falls back from GeoJSON to the server's GML when the output format is refused and remembers it per service. GML results keep the axis order declared by `srsName` and get the same polar clipping as GeoJSON. Checked against a public MapServer WFS 2.0 endpoint.

## [0.1.1] - 2026-11-17

### Fixed

- Scope publisher verification and all GeoServer service URLs to the configured workspace, preserving already scoped URLs and isolating style names.
- Request geographic WFS data, transform BBOX values explicitly and safely clip polar display coordinates before Web Mercator projection.
- Commit table paging, sorting and filtering only after a successful response; retain rows and counters and show OGC errors when a request fails.
- Group top-level capabilities leaves under one root title and stop identify format fallbacks after valid empty responses.
- Close coordinate entry after a successful move while retaining invalid-input feedback.

### Added

- Native psql seeding, configurable database ports/output paths and a Windows portable GeoServer/PostGIS recipe.
- A full neutral GeoServer example and seven opt-in live acceptance scenarios, excluded from ordinary checks and CI. Its catalog explicitly allowlists seeded layers because GeoServer can advertise global groups in virtual services.
- Regression coverage for workspace paths, polar geometries, table error retries, mixed capabilities hierarchies and identify fallbacks.

## [0.1.0] - 2026-11-16

### Added

- Runtime app/catalog JSON Schemas, cross-reference checks, external instance selection and local themes/plugins.
- OpenLayers map, GeoJSON/WMS/WFS/XYZ sources, lazy layer registry, labels and synchronized catalogs.
- Local, GeoServer CQL and OGC FES queries; search, filters, grouping, tables and CSV.
- Safe identify/popups, movable panels, measurement, markers, coordinate input, print/PNG and attribution.
- English/Bulgarian UI, local fonts/icons, responsive layout and accessible controls.
- Natural Earth demo, four example instances, documentation screenshots and optional container recipe.
- Privacy scanner/hooks, safe core updater, WMS catalog CLI, QGIS SLD export and GeoServer dry-run publication.
- Agent skill, plugin manifests, tests, CI and distribution license notices.
