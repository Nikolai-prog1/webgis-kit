---
name: webgis
description: Create/build a 2D web GIS / web map from my data (GeoJSON, GeoPackage, Shapefile, PostGIS, GeoServer), or configure layers, queries, branding and deployment in an existing webgis-kit project.
---

# WebGIS

First determine whether the working folder is a webgis-kit project (`package.json` and `app/static/config/app.json`). For a new/nonproject folder, follow [new-project](references/new-project.md): the bundled `scripts/create-project.mjs` bootstraps the version in `VERSION`, installs dependencies and preserves the source as `upstream`. A folder containing the user's data is not an empty clone destination; create a new child/sibling project and retain the input files. `WEBGIS_KIT_SOURCE` supports private/local template sources.

Establish the data location, existing PostGIS/GeoServer access, title, languages and logo from the request/files. Ask at most four short questions only when information matters and is missing; with authorized autonomous work, use and state reasonable defaults. Choose local GeoJSON (`none`) for files without a server; use `existing` for supplied servers, `portable` for a requested local server on Windows without Docker, and `docker` when Docker is available. See [stack](references/stack.md) and [import](references/import.md).

In an existing or newly bootstrapped project, read root `AGENTS.md`. Keep deployment changes in `app/` (or `WEBGIS_APP_DIR`), credentials and proxy targets in ignored `.env`. Core changes require explicit core maintenance. Import with `npm run import -- <files>`; the default `fail` mode preserves existing resources. Existing credentials are filled by the user or reused from a supplied `.env` without printing values. New managed stacks generate random passwords; do not change the passwords/data of an existing server.

Inspect the current instance and retain its IDs, languages, services and projections. Ask only for consequential information that the available configuration and request do not supply. Prefer local GeoJSON for local data, WMS for large server-rendered datasets, and WFS for attribute queries. A configured WMS layer does not prove a WFS type or field exists.

Complete **edit → `npm run validate` → `npm run dev` → browser verification**. For new maps, check each imported layer, identify, its table, and one search/filter result. Check empty and visible query results when changing queries. Without a browser tool, run `npm run smoke`; it uses Chromium when available and otherwise reports HTTP-only checks. State any remaining visual/service checks. Finish with the project location, start/stop commands, `.env` location, how to import more data and the deployment reference. Follow the task's authorization for publication; generating a plan alone does not authorize server changes or a new audience.

| Task                                       | Reference                                                                      |
| ------------------------------------------ | ------------------------------------------------------------------------------ |
| New checkout or external instance          | [new-project](references/new-project.md)                                       |
| Import GeoJSON, GeoPackage or Shapefile    | [import](references/import.md)                                                 |
| Existing, portable, Docker or no server    | [stack](references/stack.md)                                                   |
| Field names and configuration shapes       | [generated config reference](references/config-reference.md)                   |
| Add WMS, GeoJSON or WFS                    | [add-layer](references/add-layer.md)                                           |
| Search or filter attributes                | [add-search](references/add-search.md), [add-filter](references/add-filter.md) |
| Discover an external WMS                   | [external-wms](references/external-wms.md)                                     |
| Coordinate systems and input order         | [crs](references/crs.md)                                                       |
| Logo, colors and languages                 | [branding-and-theme](references/branding-and-theme.md)                         |
| QGIS export and server publication         | [geoserver-publishing](references/geoserver-publishing.md)                     |
| Serve a production build                   | [deploy](references/deploy.md)                                                 |
| Extend behavior                            | [plugins](references/plugins.md)                                               |
| Missing layers, queries or export failures | [troubleshooting](references/troubleshooting.md)                               |
