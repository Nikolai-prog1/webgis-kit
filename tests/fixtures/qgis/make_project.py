"""Build a QGIS Server project from a GeoPackage of the demo layers.

Usage (inside a QGIS image): python3 make_project.py demo.gpkg demo.qgs
Layers are published for WMS (rendering, GetFeatureInfo) and WFS (queries).
"""
import os
import sys

os.environ.setdefault('QT_QPA_PLATFORM', 'offscreen')
from qgis.core import QgsApplication, QgsCoordinateReferenceSystem, QgsProject, QgsVectorLayer  # noqa: E402

app = QgsApplication([], False)
app.initQgis()
project = QgsProject.instance()
project.setCrs(QgsCoordinateReferenceSystem('EPSG:4326'))
source, target = sys.argv[1], sys.argv[2]
ids = []
for name in ['countries', 'rivers', 'cities']:
    layer = QgsVectorLayer(f'{source}|layername={name}', name, 'ogr')
    if not layer.isValid():
        raise SystemExit(f'Invalid layer: {name}')
    project.addMapLayer(layer)
    ids.append(layer.id())
project.writeEntry('WFSLayers', '/', ids)
for layer_id in ids:
    project.writeEntry('WFSLayersPrecision', '/' + layer_id, 8)
project.writeEntry('WMSServiceCapabilities', '/', True)
project.writeEntry('WMSServiceTitle', '/', 'WebGIS Kit QGIS Server test')
project.writeEntry('WMSCrsList', '/', ['EPSG:4326', 'EPSG:3857', 'EPSG:7801'])
project.writeEntry('WMSExtent', '/', ['-180', '-85', '180', '85'])
project.writeEntry('WMSFeatureInfoUseAttributeFormSettings', '/', False)
if not project.write(target):
    raise SystemExit('Project was not written')
print(f'Wrote {target} with {len(ids)} WMS/WFS layers')
app.exitQgis()
