# Full GeoServer example

Uses the optional seed workspace `demo` with cities, rivers and countries. It covers WMS display/identify, WFS search/filter/tables, workspace capabilities and PNG export. It uses no public basemap.

```powershell
$env:GEOSERVER_URL = 'http://127.0.0.1:8080'
$env:WEBGIS_APP_DIR = 'examples/configs/geoserver-full'
npm run dev
```

GEOSERVER_URL is the server origin, without `/geoserver`; the proxy preserves that service path. Runtime configuration scopes all service operations to the `demo` workspace. Existing external instances that already include the workspace in a service URL also remain supported.

The opt-in live suite requires a seeded local server and never enters ordinary checks or CI:

```powershell
$env:WEBGIS_LIVE_GEOSERVER = '1'
npx playwright test --project=live
```

The suite reads WMS/WFS only and checks PNG data in the browser without saving a download. See the [Windows portable recipe](../../../docs/recipes/windows-portable-geoserver.md) and [seed example](../../geoserver-stack/README.md).

GeoServer may advertise global layer groups even at a workspace endpoint. This example explicitly includes only cities, rivers and countries (qualified and unqualified names), so the catalog stays focused on the seeded datasets. Adjust that allowlist when adding your own layers; no server settings or groups need to change.
