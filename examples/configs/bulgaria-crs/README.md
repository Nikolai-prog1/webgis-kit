# bulgaria-crs instance

From the repository root in PowerShell:

```powershell
$env:WEBGIS_APP_DIR = 'examples/configs/bulgaria-crs'
npm run validate
npm run dev
```

The configuration is `static/config/app.json`. Clear the environment variable to return to the default demo.

The two points are synthetic. This example needs no server. EPSG:7801 uses east/north coordinates internally and displays north/east axes. Parameters were checked against BKG metadata; coordinate order is a separate setting.
