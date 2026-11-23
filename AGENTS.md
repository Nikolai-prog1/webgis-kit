# WebGIS Kit

This is a vanilla JavaScript, OpenLayers and Vite mapping template. A deployment is an instance directory containing runtime JSON, local data, plugins and a theme.

For a new/nonproject folder, start with [the WebGIS skill](skills/webgis/SKILL.md) and its [new-project flow](skills/webgis/references/new-project.md). The installed skill's dependency-free bootstrap creates a new checkout from its bundled release tag; use a new child directory when the working folder already contains the user's data. `npm run stack` selects existing/portable/docker/none architecture and `npm run import` loads vectors and adds map controls. The default `app/` is a neutral starter; the complete Natural Earth demo is retained in `examples/configs/demo`.

For instance work, edit only `app/**` and local, ignored `.env` files. `src/`, `tools/`, `skills/`, `docs/`, `examples/`, `tests/`, `index.html` and build configuration are core files. Explicitly authorized core maintenance is a separate task; ordinary requests to add a layer, field, search, filter, logo or service belong in the instance.

Read [the WebGIS skill](skills/webgis/SKILL.md), then the reference for the requested change. Start with `app/static/config/app.json`. Catalogs live in `app/static/config/catalogs/`; local data belongs in `app/static/data/`. Configuration is loaded at runtime, so deployed JSON can be edited without rebuilding. Plugins and CSS changes require a build. An external instance is selected with `WEBGIS_APP_DIR` and has the same structure as `app/`.

Work in this cycle: edit → `npm run validate` → `npm run dev` → check the changed behavior in a browser. The full maintainer check is `npm run check`; it includes lint, JavaScript checking, unit tests, Python tests, configuration validation, build, Chromium scenarios and privacy scanning. Install dependencies with `npm ci`; install the browser with `npx playwright install chromium` when needed.

For imported data, verify layer rendering, identify, table, search and filter. `npm run smoke` builds the selected instance, starts a preview and checks configured data/WMS/WFS requests and Chromium console errors; its HTTP-only fallback does not prove visual correctness. Keep credentials in ignored `.env`; reuse existing server credentials without printing them. New managed stacks generate their own random credentials. Import defaults to `--mode fail`; replacing unrelated existing data requires explicit authorization.

Before adding a remote layer, distinguish WMS rendering from WFS attribute queries. Use configured service IDs and field names; styles pass through verbatim. Keep credentials and internal hosts out of tracked configuration. Use relative proxy paths with targets supplied through the environment, and configure production reverse proxies separately. Local GeoJSON requires no backend.

For behavior beyond JSON, add a plugin to `app/plugins/`, export it from `app/plugins/index.js`, and use `setup(ctx)` to register hooks, popup formatters, blocks or toolbar tools. Register UI extensions during setup; create map-dependent UI after `app:ready`. Do not modify core for an instance feature, add external font/icon CDNs, embed a frontend password as security, or use unlicensed tile endpoints. Treat all feature properties and configuration text as untrusted; use text nodes or the core escaped `html` helper, and use popup rows for formatter values.

Core updates use `npm run update-core -- <tag>` on a clean working tree. The tool stages core changes and reports package differences for review; it preserves `app/`, `.env`, README and LICENSE. See [upgrading](docs/upgrading.md).
