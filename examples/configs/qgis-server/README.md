# qgis-server instance

A map served by QGIS Server: WMS draws the layers and answers identify; WFS 1.1 (QGIS Server's WFS) answers search, filters and the attribute table through standard OGC filters. Publish a QGIS project with these layers enabled for WMS and WFS (Project Properties → QGIS Server), then:

```powershell
$env:WEBGIS_APP_DIR = 'examples/configs/qgis-server'
$env:QGIS_SERVER_URL = 'http://localhost:8081'   # where QGIS Server answers /ows
npm run validate
npm run dev
```

The automated test builds this project from the Natural Earth demo with [`tests/fixtures/qgis/make_project.py`](../../../tests/fixtures/qgis/make_project.py) and serves it with `qgis_mapserver`. A production QGIS Server (FastCGI behind Nginx/Apache/IIS) is configured the same way: point the `/qgis` proxy at it.
