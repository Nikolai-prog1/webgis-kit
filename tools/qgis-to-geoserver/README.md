# QGIS to GeoServer

The exporter reads a named QGIS group and writes SLD 1.0 styles, a manifest and a layer catalog. It does not change or save the project. Configure published names, groups, stores, excluded layers and label options in a copy of `export.config.example.json`; use an output directory outside this repository for deployment data.

In the QGIS Python console, add this tool directory to `sys.path`, then run:

```python
from export_from_qgis import export_project
result = export_project('export.config.json')
print(result)
```

Supported: single symbols, categorized and graduated renderers, multiple enabled symbol layers, simple markers, lines, fills, brush hatches, line-pattern fills, field labels, halos and scale bounds. Millimeters, points and pixels convert at 96 DPI. Map-unit symbols require `map_units_per_pixel`; the exporter refuses to invent a scale. Categorized expressions referring to one source field are mapped to source values. Other renderer/label expressions need adjustment before export. Warnings name omitted or approximated symbols; review them before publishing.

The publisher requires Python 3.10+ and the standard library. Review a concrete, network-free request plan first:

```sh
python tools/qgis-to-geoserver/publish_geoserver.py export/manifest.json --url http://localhost:8080/geoserver --dry-run
```

Run the same command without `--dry-run` to publish to a server you administer. Set `GEOSERVER_USER`, `GEOSERVER_PASSWORD` and the store credential environment variable, or answer the terminal prompts. Credentials are never written to manifests or logs. `--styles-only` uploads styles to an existing workspace without touching stores or feature types. Existing stores remain unchanged. Only a 404 response means a resource is missing; authentication and server errors stop publication. Successful publication checks GetMap image responses and WFS feature counts. Rerunning applies the same named resources without duplicates.

Keep real manifests, connection details and styles in your instance or another private location. Live GeoServer publication and the optional container stack need an administrator's own environment; synthetic tests exercise XML and request construction.

Verification uses the URL-encoded workspace endpoints (`/{workspace}/wms` and `/{workspace}/wfs`). This keeps a workspace style isolated from a global style with the same unqualified name.
