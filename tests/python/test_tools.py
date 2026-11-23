import io
import importlib.util
import json
import os
import subprocess
import sys
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch
from urllib.error import HTTPError
from xml.etree import ElementTree as ET

TOOLS = Path(__file__).resolve().parents[2] / 'tools/qgis-to-geoserver'
sys.path.insert(0, str(TOOLS))
from sld import write_sld, SLD, OGC
from export_from_qgis import pixels, color
from publish_geoserver import build_plan, execute_plan, Client, PublishError, contained_file

class SldTests(unittest.TestCase):
    def test_sld_point_hatch_labels_and_escaped_filters(self):
        xml = write_sld('demo', [{'name': 'one', 'title': 'A & B', 'where': {'field': 'name', 'op': 'eq', 'value': 'A < B'},
                                 'minScale': 100, 'maxScale': 50000,
                                 'symbols': [{'kind': 'point', 'shape': 'diamond', 'fill': '#112233', 'fillOpacity': .5, 'stroke': '#fff', 'size': 8},
                                             {'kind': 'polygon', 'fill': '#112233', 'hatch': 'shape://slash'}]}],
                        {'field': 'name', 'font': 'Inter', 'size': 12, 'halo': '#fff', 'haloSize': 2, 'line': True,
                         'vendorOptions': {'group': 'yes'}})
        root = ET.fromstring(xml)
        ns = {'s': SLD, 'o': OGC}
        self.assertEqual(root.get('version'), '1.0.0')
        self.assertEqual(root.find('.//o:Literal', ns).text, 'A < B')
        self.assertEqual(root.find('.//s:Graphic/s:Rotation', ns).text, '45')
        self.assertEqual(root.find('.//s:TextSymbolizer/s:Label/o:PropertyName', ns).text, 'name')
        self.assertIsNotNone(root.find('.//s:GraphicFill', ns))
        self.assertEqual(root.find('.//s:MinScaleDenominator', ns).text, '100')

    def test_range_filters_distinguish_first_lower_boundary(self):
        rules = [{'where': {'and': [{'field': 'value', 'op': op, 'value': lower}, {'field': 'value', 'op': 'lte', 'value': upper}]},
                  'symbols': [{'kind': 'line', 'stroke': '#123456', 'dasharray': [4, 2]}]}
                 for op, lower, upper in [('gte', 0, 10), ('gt', 10, 20)]]
        root = ET.fromstring(write_sld('ranges', rules))
        self.assertEqual(len(root.findall('.//{' + OGC + '}PropertyIsGreaterThanOrEqualTo')), 1)
        self.assertEqual(len(root.findall('.//{' + OGC + '}PropertyIsGreaterThan')), 1)

    def test_physical_units_and_opacity(self):
        self.assertAlmostEqual(pixels(25.4), 96)
        self.assertAlmostEqual(pixels(72, 'Point'), 96)
        self.assertEqual(pixels(10, 'Pixel'), 10)
        self.assertEqual(pixels(10, 'MapUnit', {'map_units_per_pixel': 2}), 5)
        with self.assertRaises(ValueError):
            pixels(1, 'MapUnit')
        parsed, alpha = color('20,40,60,128,rgb:0,0,0,0', .5)
        self.assertEqual(parsed, '#14283c')
        self.assertAlmostEqual(alpha, 128 / 255 * .5)

class PublicationTests(unittest.TestCase):
    def setUp(self):
        cache = Path('.cache/python-tests').resolve()
        cache.mkdir(parents=True, exist_ok=True)
        self.directory = Path(tempfile.mkdtemp(prefix='case-', dir=cache))
        self.assertTrue(self.directory.is_relative_to(cache))
        (self.directory / 'cities.sld').write_text(write_sld('cities', [{'symbols': [{'kind': 'point', 'fill': '#123456'}]}]), encoding='utf-8')
        self.manifest = {'workspace': 'demo', 'namespace': 'https://example.com/demo',
                         'stores': {'demo-data': {'database': 'webgis', 'user': 'webgis', 'passwordEnv': 'DEMO_DATABASE_CREDENTIAL'}},
                         'layers': [{'name': 'cities', 'store': 'demo-data', 'nativeName': 'cities', 'srs': 'EPSG:4326', 'sld': 'cities.sld',
                                     'extent': [10, 40, 20, 50], 'featureCount': 3}]}

    def test_plan_contains_namespace_store_styles_bbox_and_verification(self):
        plan = build_plan(self.manifest, self.directory)
        store = next(op for op in plan if op['method'] == 'POST' and op['path'].endswith('/datastores'))
        entries = {v['@key']: v['$'] for v in store['body']['dataStore']['connectionParameters']['entry']}
        self.assertEqual(entries['namespace'], '${namespace}')
        self.assertEqual(entries['passwd'], '${env:DEMO_DATABASE_CREDENTIAL}')
        self.assertTrue(any(op['method'] == 'PUT' and op.get('file') == 'cities.sld' for op in plan))
        self.assertTrue(any('recalculate=nativebbox,latlonbbox' in op['path'] for op in plan))
        self.assertTrue(any(op.get('verifyCount') == 3 for op in plan))

    def test_service_verification_is_scoped_to_the_workspace(self):
        plan = build_plan(self.manifest, self.directory)
        checks = [op for op in plan if op.get('endpoint')]
        self.assertEqual(len(checks), 2)
        self.assertTrue(checks[0]['path'].startswith('/demo/wms?'))
        self.assertTrue(checks[1]['path'].startswith('/demo/wfs?'))

    def test_existing_resources_are_not_recreated_and_counts_are_checked(self):
        class FakeClient:
            def __init__(self):
                self.calls = []
            def request(self, method, path, body, content_type, allow_missing, endpoint):
                self.calls.append((method, path, body))
                if '/namespaces/' in path:
                    return 200, {}, b'{"namespace":{"uri":"https://example.com/existing"}}'
                if endpoint and '/wms?' in path:
                    return 200, {'Content-Type': 'image/png'}, b'fixture-image'
                if endpoint:
                    return 200, {}, b'<FeatureCollection numberMatched="3"/>'
                return 200, {}, b'{}'
        client = FakeClient()
        result = execute_plan(client, build_plan(self.manifest, self.directory), self.directory)
        self.assertTrue(result)
        self.assertFalse(any(method == 'POST' for method, _path, _body in client.calls))
        self.assertTrue(any(method == 'PUT' and '/layers/' in path for method, path, _body in client.calls))

    def test_only_404_is_treated_as_absence(self):
        client = Client('https://example.com/geoserver', 'test-user', 'test-only')
        with patch('publish_geoserver.urlopen', side_effect=HTTPError('https://example.com', 404, 'Missing', {}, io.BytesIO())):
            self.assertEqual(client.request('GET', '/workspaces/demo.json', allow_missing=True)[0], 404)
        with patch('publish_geoserver.urlopen', side_effect=HTTPError('https://example.com', 403, 'Denied', {}, io.BytesIO())):
            with self.assertRaises(PublishError):
                client.request('GET', '/workspaces/demo.json', allow_missing=True)

    def test_styles_only_and_path_boundaries(self):
        plan = build_plan(self.manifest, self.directory, True)
        self.assertFalse(any('/datastores' in op['path'] or '/layers/' in op['path'] for op in plan))
        with self.assertRaises(ValueError):
            contained_file(self.directory, '../outside.sld')

    def test_dry_run_uses_no_credentials_or_network(self):
        source = self.directory / 'manifest.json'
        source.write_text(json.dumps(self.manifest), encoding='utf-8')
        environment = {**os.environ, 'DEMO_DATABASE_CREDENTIAL': 'must-not-appear-in-output'}
        result = subprocess.run([sys.executable, str(TOOLS / 'publish_geoserver.py'), str(source), '--url', 'https://example.com/geoserver', '--dry-run'],
                                capture_output=True, text=True, timeout=10, env=environment, stdin=subprocess.DEVNULL)
        self.assertEqual(result.returncode, 0, result.stderr)
        self.assertNotIn(environment['DEMO_DATABASE_CREDENTIAL'], result.stdout)
        self.assertGreater(len(json.loads(result.stdout)['operations']), 10)

class SeedTests(unittest.TestCase):
    def setUp(self):
        spec = importlib.util.spec_from_file_location('demo_seed', TOOLS.parents[1] / 'examples/geoserver-stack/seed.py')
        self.seed = importlib.util.module_from_spec(spec)
        spec.loader.exec_module(self.seed)
        cache = Path('.cache/python-tests').resolve()
        cache.mkdir(parents=True, exist_ok=True)
        self.directory = Path(tempfile.mkdtemp(prefix='seed-', dir=cache))

    def test_custom_port_is_written_to_store_manifest(self):
        self.seed.prepare(self.directory, host='localhost', port=5544)
        manifest = json.loads((self.directory / 'manifest.json').read_text(encoding='utf-8'))
        self.assertEqual(manifest['stores']['demo-data']['port'], 5544)
        self.assertEqual(manifest['stores']['demo-data']['host'], 'localhost')

    def test_native_psql_uses_arguments_and_environment_without_exposing_credentials(self):
        args = ['seed.py', '--psql', 'psql-test', '--db-host', 'localhost', '--db-port', '5544', '--output-dir', str(self.directory)]
        with patch.object(sys, 'argv', args), patch.dict(os.environ, {'PGPASSWORD': 'fixture-only'}), patch.object(self.seed.subprocess, 'run') as run, patch.object(self.seed, 'urlopen') as ready:
            ready.return_value.__enter__.return_value.status = 200
            self.seed.main()
        command = run.call_args_list[0].args[0]
        self.assertEqual(command[0], 'psql-test')
        self.assertIn('--port=5544', command)
        self.assertIn('--host=localhost', command)
        self.assertNotIn('fixture-only', ' '.join(command))
        self.assertEqual(run.call_args_list[0].kwargs['env']['PGPASSWORD'], 'fixture-only')
        self.assertEqual(len(run.call_args_list), 2)

    def test_native_dry_run_does_not_contact_database_or_server(self):
        args = ['seed.py', '--dry-run', '--psql', 'unused-psql', '--db-port', '5544', '--output-dir', str(self.directory)]
        with patch.object(sys, 'argv', args), patch.object(self.seed.subprocess, 'run') as run, patch.object(self.seed, 'urlopen') as network:
            self.seed.main()
        network.assert_not_called()
        self.assertEqual(run.call_count, 1)
        self.assertIn('--dry-run', run.call_args.args[0])

if __name__ == '__main__':
    unittest.main()
