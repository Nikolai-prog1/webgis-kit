# minimal instance

From the repository root in PowerShell:

```powershell
$env:WEBGIS_APP_DIR = 'examples/configs/minimal'
npm run validate
npm run dev
```

The configuration is `static/config/app.json`. Clear the environment variable to return to the default demo.

The two reference points are synthetic and have no external service dependency.
