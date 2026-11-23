# geoserver instance

From the repository root in PowerShell:

```powershell
$env:WEBGIS_APP_DIR = 'examples/configs/geoserver'
npm run validate
npm run dev
```

The configuration is `static/config/app.json`. Clear the environment variable to return to the default demo.

This instance expects a local GeoServer with workspace `demo` and layer `cities`. WMS draws the map; WFS exposes attributes. The layer name is qualified with the workspace automatically. Style names pass through unchanged. Provide your own service through `GEOSERVER_URL`, or use the optional container recipe. The default target is a loopback development service; configure a production reverse proxy separately.
