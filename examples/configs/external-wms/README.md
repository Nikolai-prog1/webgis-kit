# external-wms instance

From the repository root in PowerShell:

```powershell
$env:WEBGIS_APP_DIR = 'examples/configs/external-wms'
npm run validate
npm run dev
```

The configuration is `static/config/app.json`. Clear the environment variable to return to the default demo.

The sample proxy forwards to the public testing WMS. It provides no uptime guarantee. Override `EXT_WMS_URL` to use another provider; select layer names after inspecting GetCapabilities.
