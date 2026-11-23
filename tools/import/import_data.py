"""Import local vectors into an instance; only the Python standard library is required."""
import argparse
import copy
from contextlib import closing
import difflib
import json
import math
import os
import re
import shutil
import sqlite3
import subprocess
import sys
import uuid
from pathlib import Path
from urllib.parse import urlsplit

ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT / 'tools/qgis-to-geoserver'))
from sld import write_sld
from publish_geoserver import build_plan, execute_plan, Client, validate_url

TRANSLIT = dict(zip('абвгдежзийклмнопрстуфхцчшщъьюяёыэ',
                    ['a','b','v','g','d','e','zh','z','i','y','k','l','m','n','o','p','r','s','t','u','f','h','ts','ch','sh','sht','a','','yu','ya','yo','y','e']))
PALETTE = ['#4A8BDF', '#A0006D', '#EFFAFD']

def name(value, used=None):
    text = ''.join(TRANSLIT.get(char, char) for char in str(value).lower())
    text = re.sub('[^a-z0-9_]+', '_', text).strip('_') or 'layer'
    if text[0].isdigit(): text = 'layer_' + text
    text = text[:54]
    if used is not None:
        base, index = text, 2
        while text in used:
            text = f'{base}_{index}'; index += 1
        used.add(text)
    return text

def ident(value):
    return '"' + str(value).replace('"', '""') + '"'

def literal(value):
    if value is None: return 'NULL'
    if isinstance(value, bool): return 'TRUE' if value else 'FALSE'
    if isinstance(value, (int, float)):
        if not math.isfinite(value): raise ValueError('Non-finite numeric attribute.')
        return str(value)
    if isinstance(value, (dict, list)): value = json.dumps(value, ensure_ascii=False)
    return "'" + str(value).replace("'", "''") + "'"

def read_env(instance):
    result = {}
    for file in [ROOT / '.env', Path(instance) / '.env']:
        if file.exists():
            for line in file.read_text(encoding='utf-8-sig').splitlines():
                if '=' in line and not line.lstrip().startswith('#'):
                    key, value = line.split('=', 1)
                    value = value.strip()
                    if len(value) >= 2 and value[0] == value[-1] and value[0] in ('"', "'"): value = value[1:-1]
                    result[key.strip()] = value
    result.update(os.environ)
    return result

def command(args, env=None, input=None):
    result = subprocess.run([str(v) for v in args], input=input, text=True, encoding='utf-8',
                            errors='replace', env=env, capture_output=True)
    if result.returncode:
        message = result.stderr.strip() or f'{Path(args[0]).name} exited with {result.returncode}'
        for key, value in (env or {}).items():
            if value and ('PASSWORD' in key or key.endswith('_SECRET')): message = message.replace(value, '[redacted]')
        raise RuntimeError(message)
    return result.stdout

def ogr(settings):
    environment = {**os.environ, **settings}
    environment['PROJ_NETWORK'] = 'OFF'
    executable = settings.get('WEBGIS_OGR2OGR') or shutil.which('ogr2ogr')
    if not executable and os.name == 'nt':
        candidates = sorted(Path(os.environ.get('ProgramFiles', 'C:/Program Files')).glob('QGIS */bin/ogr2ogr.exe'), reverse=True)
        if candidates: executable = str(candidates[0])
    if executable:
        base = Path(executable).resolve().parents[1]
        environment['PATH'] = str(Path(executable).parent) + os.pathsep + environment.get('PATH', '')
        for key, candidates in [('GDAL_DATA', ['apps/gdal/share/gdal', 'share/gdal']), ('PROJ_LIB', ['share/proj', 'apps/proj/share/proj'])]:
            for candidate in candidates:
                if (base / candidate).exists():
                    environment.setdefault(key, str(base / candidate)); break
        return [executable], environment
    if shutil.which('docker'):
        return ['docker', 'run', '--rm', '-i', '-v', f'{Path.cwd().anchor or "/"}:/host:ro', 'ghcr.io/osgeo/gdal:ubuntu-small-latest', 'ogr2ogr'], environment
    raise RuntimeError('GeoPackage/Shapefile or projected GeoJSON needs ogr2ogr. Set WEBGIS_OGR2OGR, install GDAL/QGIS, or use --target geojson with EPSG:4326 GeoJSON.')

def convert(file, settings, layer=None, target_crs=None):
    tool, environment = ogr(settings)
    source = str(file)
    if tool[0] == 'docker':
        # Only the input's directory is exposed, read-only, to the converter.
        tool = ['docker', 'run', '--rm', '--pull=never', '-i', '-v', f'{file.parent}:/input:ro', 'ghcr.io/osgeo/gdal:ubuntu-small-latest', 'ogr2ogr']
        source = '/input/' + file.name
    args = tool + ['-preserve_fid', '-f', 'GeoJSON', '/vsistdout/', source]
    if layer: args.append(layer)
    if target_crs: args += ['-t_srs', f'EPSG:{target_crs}']
    return json.loads(command(args, environment))

def inputs(paths):
    for value in paths:
        match = re.match(r'^(.*\.gpkg):(.+)$', value, re.I)
        file, selected = (Path(match[1]), match[2]) if match else (Path(value), None)
        if file.is_dir():
            yield from inputs([str(child) for child in sorted(file.iterdir()) if child.suffix.lower() in ('.geojson','.json','.gpkg','.shp')])
        elif file.suffix.lower() == '.gpkg':
            with closing(sqlite3.connect(f'{file.resolve().as_uri()}?mode=ro', uri=True)) as db:
                layers = db.execute('SELECT table_name,srs_id FROM gpkg_geometry_columns').fetchall()
            found = False
            for layer, srid in layers:
                if selected is None or selected == layer:
                    found = True; yield file.resolve(), layer, srid
            if not found: raise ValueError(f'No matching vector layer in {file.name}.')
        elif file.suffix.lower() in ('.geojson','.json','.shp') and file.is_file():
            yield file.resolve(), None, None
        else: raise ValueError(f'Unsupported or missing input: {file}')

def positions(geometry):
    if not geometry: return
    if geometry.get('type') == 'GeometryCollection':
        for child in geometry['geometries']: yield from positions(child)
        return
    def walk(values):
        if values and isinstance(values[0], (int, float)): yield values
        else:
            for child in values: yield from walk(child)
    yield from walk(geometry.get('coordinates', []))

def dataset(file, layer=None, srid=None, settings=None, prefix='', used=None, target='postgis'):
    settings = settings or {}
    native_primary = None
    if file.suffix.lower() == '.gpkg' and layer:
        with closing(sqlite3.connect(f'{file.resolve().as_uri()}?mode=ro',uri=True)) as database:
            native_primary = next((row[1] for row in database.execute(f'PRAGMA table_info({ident(layer)})') if row[5]),None)
    data = (json.loads(file.read_text(encoding='utf-8-sig')) if file.suffix.lower() in ('.json','.geojson') else convert(file, settings, layer))
    crs = data.get('crs', {}).get('properties', {}).get('name', '')
    if not srid:
        found = re.search(r'(\d+)$', crs) if 'EPSG' in crs.upper() else None
        if crs and not found and 'CRS84' not in crs.upper():
            raise ValueError('Source CRS must have a known EPSG code before import.')
        srid = int(found[1]) if found else 4326
        if not crs: print(f'Warning: {file.name}: CRS unspecified; using EPSG:4326.', file=sys.stderr)
    if not isinstance(srid, int) or srid <= 0: raise ValueError('A positive EPSG SRID is required.')
    if target == 'geojson' and srid != 4326:
        data = convert(file, settings, layer, 4326); srid = 4326
    features = data.get('features') if data.get('type') == 'FeatureCollection' else [data]
    if not isinstance(features, list) or any(feature.get('type') != 'Feature' for feature in features):
        raise ValueError('Expected GeoJSON Feature or FeatureCollection.')
    for feature in features:
        if native_primary and isinstance(feature.get('id'),int) and native_primary not in (feature.get('properties') or {}):
            feature['properties'] = {**(feature.get('properties') or {}),native_primary:feature['id']}
        if isinstance(feature.get('id'), int) and not any(key in (feature.get('properties') or {}) for key in ['fid','id']):
            if not native_primary: feature['properties'] = {**(feature.get('properties') or {}), 'fid':feature['id']}
    labels, fields, taken = {}, {}, set()
    for feature in features:
        for key in (feature.get('properties') or {}):
            if key not in labels: labels[key] = name(key, taken)
    for original, key in labels.items():
        values = [(f.get('properties') or {}).get(original) for f in features if (f.get('properties') or {}).get(original) is not None]
        kind = 'boolean' if values and all(isinstance(v, bool) for v in values) else 'bigint' if values and all(isinstance(v, int) and not isinstance(v, bool) for v in values) else 'double precision' if values and all(isinstance(v, (float,int)) and not isinstance(v,bool) for v in values) else 'jsonb' if values and any(isinstance(v,(dict,list)) for v in values) else 'text'
        distinct = len({json.dumps(v, sort_keys=True, ensure_ascii=False) for v in values})
        fields[key] = {'type': kind, 'label': original, 'distinct': distinct}
    primary = next((key for key in [labels.get(native_primary),'fid','id'] if key in fields and fields[key]['type'] == 'bigint' and fields[key]['distinct'] == len(features)), None)
    primary = primary or name('fid', taken)
    geom = name('geom', taken)
    clean = []
    for feature in features:
        properties = {key: (feature.get('properties') or {}).get(original) for original,key in labels.items()}
        clean.append({'type': 'Feature', 'properties': properties, 'geometry': feature.get('geometry')})
    types = {f['geometry']['type'] for f in clean if f.get('geometry')}
    geometry_type = next(iter(types)) if len(types) == 1 else 'Geometry'
    families = {'polygon' if 'Polygon' in value else 'line' if 'LineString' in value else 'point' for value in types}
    kind = next(iter(families)) if len(families) == 1 else 'point'
    xy = [v for f in clean for v in positions(f.get('geometry'))]
    extent = [min(v[0] for v in xy),min(v[1] for v in xy),max(v[0] for v in xy),max(v[1] for v in xy)] if xy else [-180,-85,180,85]
    return {'name': name(prefix + (layer or file.stem), used), 'title': layer or file.stem, 'file': file, 'sourceLayer': layer,
            'srid': srid, 'geometryType': geometry_type, 'geometry': kind, 'geom': geom, 'primary': primary,
            'fields': fields, 'features': clean, 'count': len(clean), 'extent': extent if srid == 4326 else None}

def qualified(schema, table): return ident(schema) + '.' + ident(table)

def compatible_type(actual, expected):
    # PostgreSQL rejects integer overflow; cross-family casts can silently round.
    numeric = {'bigint','integer','smallint'}
    text = {'text','character varying','character'}
    return actual == expected or {actual,expected} <= numeric or {actual,expected} <= text

def load_sql(item, schema, table):
    target = qualified(schema, table)
    columns = [ident(item['primary']) + ' bigserial PRIMARY KEY']
    columns += [ident(key) + ' ' + field['type'] + (f' COLLATE pg_catalog.{ident(item["collation"])}' if item.get('collation') and field['type'] == 'text' else '') for key,field in item['fields'].items() if key != item['primary']]
    columns.append(f'{ident(item["geom"])} geometry({item["geometryType"]},{item["srid"]})')
    sql = ['BEGIN;', 'SET LOCAL standard_conforming_strings=on;', f'CREATE SCHEMA IF NOT EXISTS {ident(schema)};', f'CREATE TABLE {target} (' + ','.join(columns) + ');']
    keys = list(item['fields'])
    for feature in item['features']:
        values = [literal(feature['properties'].get(key)) for key in keys]
        geometry = feature.get('geometry')
        values.append(f'ST_SetSRID(ST_GeomFromGeoJSON({literal(json.dumps(geometry, ensure_ascii=False))}),{item["srid"]})' if geometry else 'NULL')
        sql.append(f'INSERT INTO {target} (' + ','.join(ident(k) for k in keys + [item['geom']]) + ') VALUES (' + ','.join(values) + ');')
    sql += [f'CREATE INDEX ON {target} USING gist ({ident(item["geom"])});', f'ANALYZE {target};', 'COMMIT;']
    return '\n'.join(sql) + '\n'

def project(instance):
    for base in [instance, ROOT]:
        file = base / '.webgis/project.json'
        if file.exists(): return json.loads(file.read_text(encoding='utf-8'))
    return {}

def psql(settings, instance, sql):
    executable = settings.get('WEBGIS_PSQL') or shutil.which('psql')
    environment = {**os.environ, **settings, 'PGPASSWORD': settings.get('WEBGIS_DB_PASSWORD', ''), 'PGCLIENTENCODING': 'UTF8'}
    host, port = settings.get('WEBGIS_DB_HOST','localhost'), settings.get('WEBGIS_DB_PORT','5432')
    if executable: args = [executable]
    elif project(instance).get('mode') == 'docker':
        args = ['docker','compose','--env-file',str(instance / '.env'),'-f',str(ROOT / 'stack/docker-compose.yml'),'-p',project(instance)['stackName'],'exec','-T','-e','PGPASSWORD','db','psql']
        host, port = 'localhost', '5432'
    else: raise RuntimeError('Set WEBGIS_PSQL to psql, add PostgreSQL bin to PATH, or start a managed stack.')
    args += ['--host='+host,'--port='+str(port),'--username='+settings['WEBGIS_DB_USER'],'--dbname='+settings['WEBGIS_DB_NAME'],'--no-password','-X','-q','-t','-A','-v','ON_ERROR_STOP=1']
    return command(args, environment, sql).strip()

def publish_manifest(items, settings, workspace, schema):
    store = name(settings.get('WEBGIS_DB_NAME','webgis') + '_' + schema)
    return {'version':1,'workspace':workspace,'namespace':f'https://example.com/{workspace}',
            'stores':{store:{'type':'postgis','host':settings.get('WEBGIS_DB_SERVER_HOST',settings.get('WEBGIS_DB_HOST','localhost')),
                             'port':int(settings.get('WEBGIS_DB_SERVER_PORT',settings.get('WEBGIS_DB_PORT','5432'))),
                             'database':settings.get('WEBGIS_DB_NAME','webgis'),'schema':schema,'user':settings.get('WEBGIS_DB_USER','webgis'),'passwordEnv':'WEBGIS_DB_PASSWORD'}},
            'layers':[{'name':item['name'],'store':store,'nativeName':item['name'],'title':item['title'],'srs':f'EPSG:{item["srid"]}',
                       'extent':item['extent'] or [-180,-85,180,85],'geometry':item['geometry'],'featureCount':item['count'],'sld':f'styles/{item["name"]}.sld'} for item in items]}

def configure(config, items, target, service, workspace, section=None, search='auto', filters='auto'):
    config = copy.deepcopy(config)
    sections = config.setdefault('sidebar', [])
    title = section or {'bg':'Данни','en':'Data'}
    section_id = name(section or 'data').replace('_','-')
    block = next((s for s in sections if s['id'] == section_id), None)
    if not block:
        block = {'id':section_id,'title':title,'open':True,'blocks':[]}; sections.append(block)
    listing = next((b for b in block['blocks'] if b['type'] == 'layer-list'), None)
    if not listing: listing = {'type':'layer-list','layers':[]}; block['blocks'].insert(0,listing)
    for index,item in enumerate(items):
        layer_id = item['name'].replace('_','-')
        color = PALETTE[index % len(PALETTE)]
        layer = {'id':layer_id,'title':item['title'],'geometry':item['geometry'],'visible':True,'queryable':True,'table':True,'legend':'auto',
                 'source':{'type':'wms','service':service,'layers':workspace+':'+item['name']} if target == 'postgis' else {'type':'geojson','url':f'data/{item["name"]}.geojson'},
                 'fields':{key:{'label':field['label'],**({'hidden':True} if key == item['primary'] or field['type'] == 'jsonb' else {})} for key,field in item['fields'].items()}}
        layer['fields'].setdefault(item['primary'], {'label':item['primary'],'hidden':True})
        if item['extent']: layer['extent'] = item['extent']
        if target == 'geojson': layer['style'] = {'fill':color,'stroke':'#A0006D' if color == '#EFFAFD' else color,'strokeWidth':1.5,'fillOpacity':.35,'radius':6}
        layers = config.setdefault('layers', [])
        existing = next((i for i,v in enumerate(layers) if v['id'] == layer_id), None)
        if existing is None: layers.append(layer)
        else: layers[existing] = {**layers[existing], **layer}
        if layer_id not in listing['layers']: listing['layers'].append(layer_id)
        def add_block(value):
            existing_block = next((b for b in block['blocks'] if b.get('layer') == layer_id and b['type'] == value['type']), None)
            if existing_block is not None: existing_block.update(value)
            else: block['blocks'].append(value)
        text_fields = [key for key,f in item['fields'].items() if f['type'] == 'text' and key != item['primary']]
        preferred = [key for key in text_fields if re.search('name|ime|code|kod|title',key)]
        selected = (preferred or text_fields)[:2] if search == 'auto' else search.split(',') if search != 'none' else []
        if any(key not in item['fields'] for key in selected): raise ValueError('Search field is missing from the imported data.')
        title_field = (preferred or text_fields or [item['primary']])[0]
        layer['popup'] = {'title':'{' + title_field + '}'}
        if selected: add_block({'type':'attribute-search','layer':layer_id,'fields':selected,'label':item['title'],'result':{'title':'{'+title_field+'}'},'maxZoom':14})
        controls = []
        if filters == 'auto':
            for key,field in item['fields'].items():
                if key == item['primary'] or field['type'] == 'jsonb': continue
                if field['type'] in ('bigint','double precision'): kind = 'range'
                elif field['type'] in ('text','boolean') and field['distinct'] <= 50: kind = 'select'
                else: continue
                controls.append({'type':kind,'field':key,'label':field['label'],**({'values':'auto'} if kind == 'select' else {})})
        if controls: add_block({'type':'attribute-filter','layer':layer_id,'controls':controls,'result':{'title':'{'+title_field+'}'}})
    return config

def atomic_write(file, data):
    file.parent.mkdir(parents=True, exist_ok=True)
    temporary = file.with_name(file.name + '.' + uuid.uuid4().hex + '.tmp')
    temporary.write_bytes(data)
    os.replace(temporary, file)

def save_config(file, config, validator=None):
    previous = file.read_bytes()
    atomic_write(file, (json.dumps(config, ensure_ascii=False, indent=2)+'\n').encode('utf-8'))
    try:
        if validator: validator()
        else: command(['node', ROOT / 'tools/validate-config.mjs', file.parents[2]])
    except Exception:
        atomic_write(file, previous)
        raise

def import_data(args):
    instance = Path(args.instance or os.environ.get('WEBGIS_APP_DIR') or ROOT / 'app').resolve()
    config_file = instance / 'static/config/app.json'
    config = json.loads(config_file.read_text(encoding='utf-8'))
    settings = read_env(instance)
    target = args.target or ('postgis' if settings.get('WEBGIS_DB_NAME') or project(instance).get('mode') in ('existing','portable','docker') else 'geojson')
    if not re.fullmatch('[a-z_][a-z0-9_]{0,53}', args.schema): raise ValueError('Schema must be an ASCII SQL name (lowercase letters, digits, underscores).')
    taken = set()
    items = [dataset(file,layer,srid,settings,args.prefix,taken,target) for file,layer,srid in inputs(args.inputs)]
    if not items: raise ValueError('No supported vector inputs were found.')
    services = config.setdefault('services', {})
    service = next((key for key,value in services.items() if value['type'] == 'geoserver'), 'main')
    workspace = services.get(service, {}).get('workspace') or 'webgis'
    if target == 'postgis':
        services.setdefault(service, {'type':'geoserver','url':'geoserver','workspace':workspace})
    proposed = configure(config,items,target,service,workspace,args.section,args.search,args.filter)
    manifest = publish_manifest(items,settings,workspace,args.schema)
    if args.dry_run:
        print(json.dumps({'target':target,'layers':[{'name':i['name'],'count':i['count'],'crs':f'EPSG:{i["srid"]}','geometry':i['geometryType']} for i in items],
                          'sql':[load_sql(i,args.schema,i['name']) for i in items] if target == 'postgis' else [],
                          'manifest':manifest if target == 'postgis' else None,
                          'configDiff':''.join(difflib.unified_diff(config_file.read_text(encoding='utf-8').splitlines(True),(json.dumps(proposed,ensure_ascii=False,indent=2)+'\n').splitlines(True),fromfile='app.json',tofile='app.json (planned)'))},ensure_ascii=False,indent=2))
        return items
    existing = {}
    for item in items:
        layer = next((layer for layer in config.get('layers',[]) if layer['id'] == item['name'].replace('_','-')), None)
        file_exists = (instance / f'static/data/{item["name"]}.geojson').exists()
        if args.mode == 'fail' and (layer or (file_exists and target == 'geojson')): raise ValueError(f'{item["name"]} already exists; no changes made. Choose a prefix, append or replace explicitly.')
        if target == 'postgis':
            required = ['WEBGIS_DB_NAME','WEBGIS_DB_USER','WEBGIS_DB_PASSWORD','GEOSERVER_URL','GEOSERVER_USER','GEOSERVER_PASSWORD']
            missing = [key for key in required if not settings.get(key)]
            if missing: raise ValueError('Fill the existing server settings in the instance .env: ' + ', '.join(missing))
            existing[item['name']] = psql(settings,instance,f'SELECT to_regclass({literal(args.schema+"."+item["name"])});') != ''
            if existing[item['name']] and args.mode == 'fail': raise ValueError(f'Table {item["name"]} already exists; no changes made.')
    if target == 'postgis':
        collation = psql(settings,instance,"SELECT collname FROM pg_collation WHERE collname='und-x-icu' AND collprovider='i' AND collnamespace='pg_catalog'::regnamespace LIMIT 1;") or None
        for item in items: item['collation'] = collation
        if not collation:
            print('Note: ICU Unicode collation is unavailable; imported text uses the database default case rules.',file=sys.stderr)
    audit = instance / '.webgis/imports' / uuid.uuid4().hex
    audit.mkdir(parents=True)
    (audit / 'config-before.json').write_bytes(config_file.read_bytes())
    if target == 'geojson':
        for item in items:
            file = instance / f'static/data/{item["name"]}.geojson'
            if file.exists():
                (audit / file.name).write_bytes(file.read_bytes())
                if args.mode == 'append':
                    item['features'] = json.loads(file.read_text(encoding='utf-8'))['features'] + item['features']
                    item['count'] = len(item['features'])
            atomic_write(file,(json.dumps({'type':'FeatureCollection','features':item['features']},ensure_ascii=False)+'\n').encode('utf-8'))
    else:
        for item in items:
            staging = name(item['name'][:38] + '_load_' + uuid.uuid4().hex[:8])
            sql = load_sql(item,args.schema,staging)
            (audit / (item['name']+'.sql')).write_text(sql,encoding='utf-8')
            # Vector drivers decode GPKG/DBF and ogr2ogr loads these formats.
            if item['file'].suffix.lower() in ('.gpkg','.shp'):
                psql(settings,instance,f'CREATE SCHEMA IF NOT EXISTS {ident(args.schema)};')
                normalized = audit / (item['name']+'.geojson')
                normalized_features = [{**feature,**({'id':feature['properties'][item['primary']]} if item['primary'] in feature['properties'] else {})} for feature in item['features']]
                normalized.write_text(json.dumps({'type':'FeatureCollection','crs':{'type':'name','properties':{'name':f'EPSG:{item["srid"]}'}},'features':normalized_features},ensure_ascii=False),encoding='utf-8')
                tool, environment = ogr(settings)
                connection = 'PG:' + ' '.join(key+'='+settings.get(env,default) for key,env,default in [('host','WEBGIS_DB_HOST','localhost'),('port','WEBGIS_DB_PORT','5432'),('dbname','WEBGIS_DB_NAME','webgis'),('user','WEBGIS_DB_USER','webgis')])
                environment['PGPASSWORD'] = settings['WEBGIS_DB_PASSWORD']
                if tool[0] == 'docker':
                    metadata = project(instance)
                    tool = ['docker','run','--rm','-i','-e','PGPASSWORD','--network',metadata.get('stackName','webgis')+'_default','-v',f'{audit}:/input:ro','ghcr.io/osgeo/gdal:ubuntu-small-latest','ogr2ogr']
                    normalized = Path('/input') / normalized.name
                    connection = connection.replace('host='+settings.get('WEBGIS_DB_HOST','localhost'),'host='+settings.get('WEBGIS_DB_SERVER_HOST','db')).replace('port='+settings.get('WEBGIS_DB_PORT','5432'),'port=5432')
                command(tool+['-f','PostgreSQL',connection,str(normalized),'-nln',staging,'-lco','SCHEMA='+args.schema,'-lco','GEOMETRY_NAME='+item['geom'],'-lco','FID='+item['primary'],'-preserve_fid','-a_srs',f'EPSG:{item["srid"]}'],environment)
                if item.get('collation'):
                    alter = [f'ALTER TABLE {qualified(args.schema,staging)} ALTER COLUMN {ident(key)} TYPE text COLLATE pg_catalog.{ident(item["collation"])} USING {ident(key)}::text;' for key,field in item['fields'].items() if field['type'] == 'text' and key != item['primary']]
                    if alter: psql(settings,instance,'BEGIN;\n'+'\n'.join(alter)+'\nCOMMIT;')
            else: psql(settings,instance,sql)
            target_table = qualified(args.schema,item['name']); staged = qualified(args.schema,staging)
            if existing[item['name']] and args.mode == 'append':
                actual = json.loads(psql(settings,instance,f'SELECT json_object_agg(column_name,data_type) FROM information_schema.columns WHERE table_schema={literal(args.schema)} AND table_name={literal(item["name"])};'))
                expected = set(item['fields']) | {item['primary'],item['geom']}
                if set(actual) != expected: raise ValueError('Append refused: column names are incompatible; original table is unchanged.')
                for key,field in item['fields'].items():
                    if key != item['primary'] and not compatible_type(actual[key],field['type']): raise ValueError('Append refused: column types are incompatible; original table is unchanged.')
                srid = psql(settings,instance,f'SELECT srid FROM geometry_columns WHERE f_table_schema={literal(args.schema)} AND f_table_name={literal(item["name"])};')
                if srid != str(item['srid']): raise ValueError('Append refused: CRS is incompatible; original table is unchanged.')
                columns = [key for key in item['fields'] if key != item['primary']] + [item['geom']]
                cols = ','.join(ident(k) for k in columns)
                swap = f'SELECT setval(pg_get_serial_sequence({literal(target_table)},{literal(item["primary"])}),GREATEST(COALESCE((SELECT max({ident(item["primary"])}) FROM {target_table}),1),1),true);\nINSERT INTO {target_table} ({cols}) SELECT {cols} FROM {staged};'
            else:
                swap = ''
                if existing[item['name']]: swap += f'ALTER TABLE {target_table} RENAME TO {ident(name(item["name"][:36]+"_backup_"+uuid.uuid4().hex[:8]))};\n'
                swap += f'ALTER TABLE {staged} RENAME TO {ident(item["name"])};'
            psql(settings,instance,'BEGIN;\n'+swap+f'\nANALYZE {target_table};\nCOMMIT;')
            distinct = ','.join(literal(key)+f',count(DISTINCT {ident(key)})' for key,field in item['fields'].items() if field['type'] != 'jsonb')
            stats = json.loads(psql(settings,instance,f'SELECT json_build_object(\'count\',count(*),\'extent\',json_build_array(ST_XMin(ST_Extent(ST_Transform({ident(item["geom"])},4326))),ST_YMin(ST_Extent(ST_Transform({ident(item["geom"])},4326))),ST_XMax(ST_Extent(ST_Transform({ident(item["geom"])},4326))),ST_YMax(ST_Extent(ST_Transform({ident(item["geom"])},4326)))),\'distinct\',json_build_object({distinct})) FROM {target_table};'))
            item['count'] = stats['count']
            item['extent'] = stats['extent'] if all(v is not None for v in stats['extent']) else [-180,-85,180,85]
            for key,value in stats['distinct'].items(): item['fields'][key]['distinct'] = value
        manifest = publish_manifest(items,settings,workspace,args.schema)
        (audit / 'styles').mkdir()
        for index,item in enumerate(items):
            color = PALETTE[index % len(PALETTE)]
            symbol = {'kind':item['geometry'],'fill':color,'stroke':'#A0006D' if color == '#EFFAFD' else color,'width':1.5,'size':9,'fillOpacity':.4}
            (audit / f'styles/{item["name"]}.sld').write_text(write_sld(item['name'],[{'symbols':[symbol]}]),encoding='utf-8')
        (audit / 'manifest.json').write_text(json.dumps(manifest,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
        url = settings['GEOSERVER_URL'].rstrip('/')
        if not urlsplit(url).path: url += '/geoserver'
        validate_url(url)
        # Publisher substitution receives the credential only through the environment.
        previous = os.environ.get('WEBGIS_DB_PASSWORD')
        try:
            os.environ['WEBGIS_DB_PASSWORD'] = settings['WEBGIS_DB_PASSWORD']
            execute_plan(Client(url,settings['GEOSERVER_USER'],settings['GEOSERVER_PASSWORD']),build_plan(manifest,audit),audit,manifest['namespace'])
        finally:
            if previous is None: os.environ.pop('WEBGIS_DB_PASSWORD',None)
            else: os.environ['WEBGIS_DB_PASSWORD'] = previous
        proxy_file = instance / 'proxy.json'
        proxy = json.loads(proxy_file.read_text(encoding='utf-8')) if proxy_file.exists() else []
        if not any(rule['path'] == '/geoserver' for rule in proxy):
            proxy.append({'path':'/geoserver','env':'GEOSERVER_URL','stripPrefix':True})
            atomic_write(proxy_file,(json.dumps(proxy,indent=2)+'\n').encode())
    proposed = configure(config,items,target,service,workspace,args.section,args.search,args.filter)
    save_config(config_file,proposed)
    print('Layer | Table | GeoServer layer | Features | Map controls')
    for item in items: print(f'{item["title"]} | {args.schema+"."+item["name"] if target == "postgis" else "local GeoJSON"} | {workspace+":"+item["name"] if target == "postgis" else "—"} | {item["count"]} | layer, identify, table, search/filter as configured')
    print('Next: npm run validate, then npm run dev and open the printed local URL.')
    return items

def main():
    if hasattr(sys.stdout,'reconfigure'): sys.stdout.reconfigure(encoding='utf-8')
    if hasattr(sys.stderr,'reconfigure'): sys.stderr.reconfigure(encoding='utf-8')
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('inputs',nargs='+')
    parser.add_argument('--instance')
    parser.add_argument('--target',choices=['postgis','geojson'])
    parser.add_argument('--schema',default='public')
    parser.add_argument('--prefix',default='')
    parser.add_argument('--mode',choices=['fail','append','replace'],default='fail')
    parser.add_argument('--search',default='auto')
    parser.add_argument('--filter',choices=['auto','none'],default='auto')
    parser.add_argument('--section')
    parser.add_argument('--dry-run',action='store_true')
    try: import_data(parser.parse_args())
    except (ValueError,RuntimeError,OSError,sqlite3.Error) as error:
        print('Import failed: '+str(error),file=sys.stderr); return 1
    return 0

if __name__ == '__main__': sys.exit(main())
