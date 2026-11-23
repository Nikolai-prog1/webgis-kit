# New project

Use this flow when no webgis-kit checkout is present. Read the user's request, data directory and any supplied connection notes before asking. At most four short questions can cover: files/server access; title; languages; logo. Already answered questions do not need to be asked. For autonomous work, default to a descriptive map title, English/Bulgarian, no logo, and files without a server as local GeoJSON; state these choices.

```sh
node "<skill>/scripts/create-project.mjs" "<project>" --name "My web map"
```

`<skill>` is the installed skill directory. The script requires Node 24+, npm 11+ and Git; it has no npm dependencies itself. It refuses nonempty targets, so if the current directory contains `data/` or `.env`, choose a new child such as `map/`. Keep the originals in place and use their relative/absolute paths for import. Bootstrap normally installs project-local dependencies; `--no-install` is for deliberate offline preparation. `--demo` copies the retained Natural Earth demo instead of the empty starter. `WEBGIS_KIT_SOURCE` or `--source` can select an authorized local/private source; `--ref` overrides the bundled release tag.

From the new project's directory choose the architecture:

| Available inputs / requested architecture      | Command                                                               |
| ---------------------------------------------- | --------------------------------------------------------------------- |
| Files, no server requested                     | `npm run stack -- up --mode none`                                     |
| Existing server connection supplied            | `npm run stack -- up --mode existing`, then `npm run stack -- status` |
| Local server requested, Windows x64, no Docker | `npm run stack -- up --mode portable`                                 |
| Docker available and a server requested        | `npm run stack -- up --mode docker`                                   |

If an existing `.env` is supplied in the parent directory, copy it into the new project's ignored `.env` without displaying its values. Otherwise existing mode creates empty password placeholders for the user to fill. Reuse the supplied workspace/schema and stay within the authorized dataset scope; do not import into unrelated `public`/demo tables. If a required server is missing, report it and choose an isolated managed stack only when the request authorizes creating one. See [stack](stack.md).

Import data with [the import command](import.md). Use `--schema <authorized-schema>` for PostGIS, `--target geojson` for `none`, and a dry-run first for large/many files. The importer publishes WMS/WFS layers when PostGIS/GeoServer are configured, adds table/identify controls, and generates search/filter blocks. To select a workspace, configure a `geoserver` service with that workspace in `app/static/config/app.json` before importing. Run commands from the project directory, using `../data` when the data belongs to its parent.

Apply title, logo, colors and languages using [branding-and-theme](branding-and-theme.md). The starter includes the kit's pale-blue, royal-blue and eggplant palette. Keep instance edits in `app/`; an external `WEBGIS_APP_DIR` has `static/config/app.json`, `plugins/index.js`, `theme.css`, `proxy.json` and optional ignored `.env`.

Run `npm run validate`, start `npm run dev`, then check the map in a browser: every layer visible, identify popup, attribute table, a search result and an applied filter. Use `npm run smoke -- --screenshot <file>` as additional evidence. Without a browser tool, smoke uses installed Chromium; if Chromium is unavailable it performs HTTP configuration/data/WMS/WFS checks and explicitly leaves visual inspection unverified. Internet basemaps need connectivity; use the configured no-basemap choice for a local-only map.

Finish by explaining where the project lives, `npm run dev` and `npm run stack -- down`, credentials in ignored `.env`, `npm run import -- <more-files>`, and [deployment](deploy.md). Servers in `existing` mode are not stopped by the kit. Keep local servers bound to localhost until the user chooses a deployment/audience.
