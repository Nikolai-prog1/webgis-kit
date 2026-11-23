# Configuration

For `services` entries with `type: "geoserver"`, set `url` to the server's base (for example `geoserver`) and `workspace` to the application workspace. WMS requests use `{url}/{workspace}/wms` and WFS requests use `{url}/{workspace}/wfs`; an already scoped URL is not scoped twice. Without a workspace, these remain the global `/wms` and `/wfs` endpoints. Layer names remain qualified; style names pass through unchanged and resolve within the workspace.

`app/static/config/app.json` contains application identity, branding, links, view, CRS definitions, named services, basemaps, standalone layers, catalogs, sidebar blocks, toolbar tools, status, identify, print and message overrides. `version` is 1. Catalog files contain defaults and groups of layer definitions. Every app/catalog file has an editor `$schema` path; runtime ignores that path.

Read the [generated field reference](../skills/webgis/references/config-reference.md). IDs are stable internal identifiers; titles and displayed labels accept a string or language map. Fallback is current language â†’ English â†’ first value. Coordinates/extents are longitude/latitude unless a CRS `bbox` explicitly contains projected coordinates. Relative URLs resolve against the document directory, including a deployment subdirectory.

Schema validation rejects malformed types and source options. Cross checks reject duplicates, missing references, invalid default basemaps, custom CRS without definitions, projected input without bounds and malformed bounds. Catalog defaults are merged before cross checks; WMS query types derive from source settings unless explicitly set. GeoServer layer names gain a workspace prefix when absent; style names pass through unchanged.

The instance boundary is `app/**` and ignored environment files. Runtime config changes do not need a new build. Plugin/theme changes do. To select a separate instance in PowerShell:

```powershell
$env:WEBGIS_APP_DIR = 'examples/configs/minimal'
npm run validate
npm run dev
```

Remove that environment variable to return to the starter. Use `WEBGIS_APP_DIR=examples/configs/demo` for the Natural Earth demo. Complete minimal, GeoServer, external-WMS and regional-CRS examples live in `examples/configs/`. JSON examples in documentation are validated with the shipped schemas; keep examples executable rather than adding comments or ellipses to JSON.
