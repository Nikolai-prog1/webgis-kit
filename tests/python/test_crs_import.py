import contextlib
import importlib.util
import io
import json
import shutil
import subprocess
import tempfile
import unittest
from pathlib import Path
from types import SimpleNamespace

ROOT = Path(__file__).resolve().parents[2]
spec = importlib.util.spec_from_file_location('webgis_import_crs', ROOT / 'tools/import/import_data.py')
module = importlib.util.module_from_spec(spec)
spec.loader.exec_module(module)
OGR = shutil.which('ogr2ogr')

# Five Vitosha points; every route below must bring them back to these values.
POINTS = [[23.2906, 42.5856], [23.2727, 42.6072], [23.2786, 42.5636], [23.2422, 42.5958], [23.2389, 42.6097]]
SOURCE = {'type': 'FeatureCollection', 'features': [
    {'type': 'Feature', 'properties': {'id': i + 1, 'name': f'P{i + 1}'}, 'geometry': {'type': 'Point', 'coordinates': xy}}
    for i, xy in enumerate(POINTS)]}
LOCAL = '+proj=sterea +lat_0=42.5 +lon_0=25 +k=0.9999 +x_0=500000 +y_0=4700000 +ellps=GRS80 +units=m +no_defs'

@unittest.skipUnless(OGR, 'GDAL ogr2ogr is required for reprojection tests')
class CrsImportTests(unittest.TestCase):
    def setUp(self):
        (ROOT / '.cache/python-tests').mkdir(parents=True, exist_ok=True)
        self.root = Path(tempfile.mkdtemp(prefix='crs-', dir=ROOT / '.cache/python-tests'))
        (self.root / 'wgs84.geojson').write_text(json.dumps(SOURCE), encoding='utf-8')

    def project(self, name, srs, driver='GeoJSON', strip_crs=False):
        target = self.root / name
        subprocess.run([OGR, '-f', driver, str(target), str(self.root / 'wgs84.geojson'), '-t_srs', srs],
                       check=True, capture_output=True)
        if strip_crs:
            data = json.loads(target.read_text(encoding='utf-8')); data.pop('crs', None)
            target.write_text(json.dumps(data), encoding='utf-8')
        return target

    def assert_points(self, item):
        got = [f['geometry']['coordinates'] for f in item['features']]
        for actual, expected in zip(got, POINTS):
            self.assertAlmostEqual(actual[0], expected[0], places=6)
            self.assertAlmostEqual(actual[1], expected[1], places=6)
        self.assertEqual(item['srid'], 4326)

    def quiet(self, *args, **kwargs):
        with contextlib.redirect_stderr(io.StringIO()):
            return module.dataset(*args, **kwargs)

    def test_declared_epsg_geojson_is_reprojected_for_local_maps(self):
        self.assert_points(self.quiet(self.project('bgs.geojson', 'EPSG:7801'), target='geojson'))

    def test_declared_epsg_is_kept_native_for_postgis(self):
        item = self.quiet(self.project('bgs.geojson', 'EPSG:7801'), target='postgis')
        self.assertEqual(item['srid'], 7801)
        self.assertGreater(item['features'][0]['geometry']['coordinates'][0], 100000)

    def test_undeclared_projected_data_are_refused_with_guidance(self):
        file = self.project('bare.geojson', 'EPSG:7801', strip_crs=True)
        with self.assertRaisesRegex(ValueError, '--srs'):
            self.quiet(file, target='geojson')

    def test_srs_option_names_the_source(self):
        file = self.project('bare.geojson', 'EPSG:32635', strip_crs=True)
        self.assert_points(self.quiet(file, target='geojson', srs='EPSG:32635'))
        self.assert_points(self.quiet(file, target='geojson', srs='32635'))

    def test_shapefile_with_epsg_less_prj_is_reprojected_automatically(self):
        file = self.project('local.shp', LOCAL, driver='ESRI Shapefile')
        self.assert_points(self.quiet(file, target='postgis'))
        self.assert_points(self.quiet(file, target='geojson', srs=str(file.with_suffix('.prj'))))

    def test_geopackage_in_a_custom_system_is_reprojected(self):
        file = self.project('local.gpkg', LOCAL, driver='GPKG')
        [(path, layer, srid)] = list(module.inputs([str(file)]))
        self.assertIsNone(srid)
        self.assert_points(self.quiet(path, layer, srid, target='postgis'))

if __name__ == '__main__': unittest.main()
