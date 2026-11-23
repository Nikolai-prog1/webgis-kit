import contextlib
import importlib.util
import io
import json
import os
import shutil
import sqlite3
import tempfile
import unittest
from pathlib import Path
from types import SimpleNamespace
from unittest.mock import patch

ROOT = Path(__file__).resolve().parents[2]
spec = importlib.util.spec_from_file_location('webgis_import', ROOT / 'tools/import/import_data.py')
module = importlib.util.module_from_spec(spec)
spec.loader.exec_module(module)

class ImportTests(unittest.TestCase):
    def setUp(self):
        (ROOT / '.cache/python-tests').mkdir(parents=True, exist_ok=True)
        self.root = Path(tempfile.mkdtemp(prefix='import-', dir=ROOT / '.cache/python-tests'))
        self.instance = self.root / 'instance'
        shutil.copytree(ROOT / 'templates/starter-app', self.instance)
        self.file = self.root / 'points.geojson'
        self.data = {'type':'FeatureCollection','features':[
            {'type':'Feature','properties':{'id':1,'Име':"O'Brien",'value':12.5,'category':'one'},'geometry':{'type':'Point','coordinates':[25,43]}},
            {'type':'Feature','properties':{'id':2,'Име':'Beta','value':18,'category':'two'},'geometry':{'type':'Point','coordinates':[26,44]}}
        ]}
        self.file.write_text(json.dumps(self.data, ensure_ascii=False), encoding='utf-8')

    def args(self, **extra):
        return SimpleNamespace(**{**dict(instance=str(self.instance),target='geojson',schema='public',prefix='',mode='fail',search='auto',filter='auto',section=None,dry_run=False,inputs=[str(self.file)]), **extra})

    def test_transliteration_unique_names_and_safe_sql(self):
        taken = set()
        self.assertEqual(module.name('Пътни участъци', taken),'patni_uchastatsi')
        self.assertEqual(module.name('Пътни участъци', taken),'patni_uchastatsi_2')
        self.assertEqual(module.ident('a"b'), '"a""b"')
        self.assertEqual(module.literal("O'Brien"), "'O''Brien'")
        item = module.dataset(self.file)
        sql = module.load_sql(item,'test_schema','points')
        self.assertIn('geometry(Point,4326)',sql)
        self.assertIn('"id" bigserial PRIMARY KEY',sql)
        self.assertIn("'O''Brien'",sql)
        self.assertIn('USING gist',sql)
        self.assertEqual(item['fields']['ime']['label'],'Име')
        self.assertEqual(item['count'],2)

    def test_manifest_uses_environment_reference_not_a_password(self):
        item = module.dataset(self.file)
        manifest = module.publish_manifest([item],{'WEBGIS_DB_NAME':'map','WEBGIS_DB_USER':'reader','WEBGIS_DB_PASSWORD':'fixture-secret','WEBGIS_DB_PORT':'5434'},'fixture','data')
        self.assertNotIn('fixture-secret',json.dumps(manifest))
        store = next(iter(manifest['stores'].values()))
        self.assertEqual(store['passwordEnv'],'WEBGIS_DB_PASSWORD')
        self.assertEqual(store['port'],5434)
        self.assertEqual(store['schema'],'data')

    def test_gdal_crs84_is_geographic_and_not_epsg_84(self):
        self.data['crs'] = {'type':'name','properties':{'name':'urn:ogc:def:crs:OGC:1.3:CRS84'}}
        self.file.write_text(json.dumps(self.data),encoding='utf-8')
        self.assertEqual(module.dataset(self.file)['srid'],4326)

    def test_single_and_multi_geometries_share_the_correct_style_family(self):
        self.data['features'][0]['geometry'] = {'type':'Polygon','coordinates':[[[25,43],[26,43],[25,44],[25,43]]]}
        self.data['features'][1]['geometry'] = {'type':'MultiPolygon','coordinates':[[[[25,43],[26,43],[25,44],[25,43]]]]}
        self.file.write_text(json.dumps(self.data),encoding='utf-8')
        item = module.dataset(self.file)
        self.assertEqual(item['geometry'],'polygon')
        self.assertEqual(item['geometryType'],'Geometry')

    def test_auto_controls_preserve_existing_configuration(self):
        config = json.loads((self.instance / 'static/config/app.json').read_text(encoding='utf-8'))
        config['branding']['subtitle'] = 'Keep this'
        item = module.dataset(self.file)
        updated = module.configure(config,[item],'geojson','main','fixture')
        self.assertEqual(updated['branding']['subtitle'],'Keep this')
        self.assertEqual(config.get('layers'),[])
        blocks = updated['sidebar'][-1]['blocks']
        self.assertEqual(next(b for b in blocks if b['type'] == 'attribute-search')['fields'],['ime'])
        controls = next(b for b in blocks if b['type'] == 'attribute-filter')['controls']
        self.assertIn({'type':'range','field':'value'},controls)
        self.assertIn({'type':'select','field':'category','values':'auto'},controls)
        self.assertEqual(next(b for b in blocks if b['type'] == 'attribute-search')['placeholder'],'Име')
        self.assertTrue(updated['layers'][0]['fields']['id']['hidden'])
        self.assertEqual(module.configure(updated,[item],'geojson','main','fixture')['sidebar'][-1]['blocks'],blocks)

    def test_first_import_opens_on_the_data_and_keeps_a_chosen_view(self):
        config = json.loads((self.instance / 'static/config/app.json').read_text(encoding='utf-8'))
        item = module.dataset(self.file)
        view = module.configure(config,[item],'geojson','main','fixture')['map']
        west, south, east, north = view['homeExtent']
        self.assertTrue(west < 25 and south < 43 and east > 26 and north > 44)
        self.assertEqual(view['center'],[25.5,43.5])
        self.assertTrue(5 <= view['zoom'] <= 9)
        config['map']['homeExtent'] = [20,40,30,45]
        self.assertEqual(module.configure(config,[item],'geojson','main','fixture')['map']['homeExtent'],[20,40,30,45])

    def test_single_feature_layers_get_no_automatic_search_or_filter(self):
        self.data['features'] = self.data['features'][:1]
        self.file.write_text(json.dumps(self.data, ensure_ascii=False), encoding='utf-8')
        config = json.loads((self.instance / 'static/config/app.json').read_text(encoding='utf-8'))
        updated = module.configure(config,[module.dataset(self.file)],'geojson','main','fixture')
        kinds = [b['type'] for b in updated['sidebar'][-1]['blocks']]
        self.assertEqual(kinds,['layer-list'])
        self.assertTrue(updated['map']['zoom'] >= 12)

    def test_atomic_configuration_write_rolls_back_validation_failure(self):
        file = self.instance / 'static/config/app.json'
        before = file.read_bytes()
        with self.assertRaisesRegex(ValueError,'invalid'):
            module.save_config(file,{'invalid':True},lambda: (_ for _ in ()).throw(ValueError('invalid')))
        self.assertEqual(file.read_bytes(),before)

    def test_sql_names_and_map_ids_use_their_own_valid_syntax(self):
        item = module.dataset(self.file,prefix='survey_')
        config = json.loads((self.instance / 'static/config/app.json').read_text(encoding='utf-8'))
        updated = module.configure(config,[item],'geojson','main','fixture')
        self.assertEqual(item['name'],'survey_points')
        self.assertEqual(updated['layers'][0]['id'],'survey-points')
        self.assertEqual(updated['sidebar'][-1]['blocks'][1]['layer'],'survey-points')

    def test_geojson_import_fail_append_replace_and_validation(self):
        with contextlib.redirect_stdout(io.StringIO()):
            module.import_data(self.args())
        config_file = self.instance / 'static/config/app.json'
        output = self.instance / 'static/data/points.geojson'
        before = (config_file.read_bytes(),output.read_bytes())
        with self.assertRaisesRegex(ValueError,'already exists'):
            module.import_data(self.args())
        self.assertEqual((config_file.read_bytes(),output.read_bytes()),before)
        with contextlib.redirect_stdout(io.StringIO()):
            module.import_data(self.args(mode='append'))
        self.assertEqual(len(json.loads(output.read_text())['features']),4)
        with contextlib.redirect_stdout(io.StringIO()):
            module.import_data(self.args(mode='replace'))
        self.assertEqual(len(json.loads(output.read_text())['features']),2)

    def test_dry_run_has_no_writes_commands_credentials_or_network(self):
        before = sorted(p.relative_to(self.root) for p in self.root.rglob('*'))
        with patch.object(module,'command',side_effect=AssertionError('No processes')), patch.dict(os.environ,{'WEBGIS_DB_PASSWORD':'fixture-secret'}), contextlib.redirect_stdout(io.StringIO()) as output:
            module.import_data(self.args(target='postgis',dry_run=True))
        self.assertNotIn('fixture-secret',output.getvalue())
        self.assertIn('configDiff',output.getvalue())
        self.assertEqual(before,sorted(p.relative_to(self.root) for p in self.root.rglob('*')))

    def test_connection_values_keep_embedded_and_trailing_quotes(self):
        (self.instance / '.env').write_text('WEBGIS_DB_PASSWORD=\'fixture"\'\n',encoding='utf-8')
        with patch.dict(os.environ,{},clear=True):
            self.assertEqual(module.read_env(self.instance)['WEBGIS_DB_PASSWORD'],'fixture"')

    def test_geopackage_primary_key_name_and_nonsequential_values_are_retained(self):
        file=self.root/'keys.gpkg'
        with contextlib.closing(sqlite3.connect(file)) as database:
            database.execute('CREATE TABLE records (source_key INTEGER PRIMARY KEY, name TEXT)')
        data=json.loads(json.dumps(self.data))
        for feature,key in zip(data['features'],[101,205]):
            feature['id']=key
            feature['properties']={'name':'Record '+str(key)}
        with patch.object(module,'convert',return_value=data):
            item=module.dataset(file,'records',4326)
        self.assertEqual(item['primary'],'source_key')
        self.assertEqual([f['properties']['source_key'] for f in item['features']],[101,205])
        self.assertIn('"source_key" bigserial PRIMARY KEY',module.load_sql(item,'fixture','records'))

    def test_driver_text_and_numeric_column_variants_are_append_compatible(self):
        self.assertTrue(module.compatible_type('character varying','text'))
        self.assertTrue(module.compatible_type('integer','bigint'))
        self.assertFalse(module.compatible_type('text','bigint'))
        self.assertFalse(module.compatible_type('boolean','text'))
        self.assertFalse(module.compatible_type('bigint','double precision'))
        self.assertFalse(module.compatible_type('real','bigint'))

    def test_unicode_collation_is_applied_only_to_new_text_columns(self):
        item=module.dataset(self.file)
        item['collation']='und-x-icu'
        sql=module.load_sql(item,'fixture','places')
        self.assertIn('"ime" text COLLATE pg_catalog."und-x-icu"',sql)
        self.assertIn('"value" double precision,',sql)
        self.assertNotIn('double precision COLLATE',sql)

if __name__ == '__main__': unittest.main()
