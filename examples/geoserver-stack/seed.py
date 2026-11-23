"""Seed a local demo through Docker or native psql; dry-run needs neither."""
import argparse
import json
import os
import subprocess
import sys
import time
from pathlib import Path
from urllib.request import urlopen

ROOT = Path(__file__).resolve().parents[2]
STACK = Path(__file__).resolve().parent
sys.path.insert(0, str(ROOT / 'tools/qgis-to-geoserver'))
from sld import write_sld

def sql_value(value):
    return 'NULL' if value is None else "'" + str(value).replace("'", "''") + "'"

def positions(coordinates):
    if coordinates and isinstance(coordinates[0], (float, int)):
        yield coordinates
    else:
        for part in coordinates:
            yield from positions(part)

def prepare(directory, workspace='demo', database='webgis', user='webgis', host='db', port=5432):
    if not 1 <= port <= 65535:
        raise ValueError('Database port must be between 1 and 65535.')
    directory = Path(directory)
    (directory / 'styles').mkdir(parents=True, exist_ok=True)
    sql = ['BEGIN;', 'CREATE EXTENSION IF NOT EXISTS postgis;']
    manifest = {'version': 1, 'workspace': workspace, 'namespace': f'https://example.com/{workspace}',
                'stores': {'demo-data': {'type': 'postgis', 'host': host, 'port': port, 'database': database, 'user': user, 'passwordEnv': 'POSTGRES_PASSWORD'}}, 'layers': []}
    counts = {}
    for name, kind, fill, stroke in [('cities', 'point', '#17655b', '#ffffff'), ('rivers', 'line', None, '#4a8db4'), ('countries', 'polygon', '#d0ded6', '#568276')]:
        data = json.loads((ROOT / f'examples/configs/demo/static/data/{name}.geojson').read_text(encoding='utf-8'))
        sql.append(f'CREATE TABLE IF NOT EXISTS public.{name} (id bigserial PRIMARY KEY, seed_id text UNIQUE, name text, country text, continent text, population bigint, tags text, tags_filter text, geom geometry(Geometry,4326));')
        xy = []
        for index, feature in enumerate(data['features']):
            properties = feature['properties']
            geometry = feature.get('geometry')
            xy.extend(positions(geometry['coordinates']) if geometry else [])
            population = properties.get('population')
            values = [sql_value(f'{name}:{index}'), *[sql_value(properties.get(field)) for field in ['name', 'country', 'continent']],
                      str(round(population)) if isinstance(population, (float, int)) else 'NULL', sql_value(properties.get('tags')), sql_value(properties.get('tags_filter')),
                      'ST_SetSRID(ST_GeomFromGeoJSON(' + sql_value(json.dumps(geometry)) + '),4326)' if geometry else 'NULL']
            sql.append(f'INSERT INTO public.{name} (seed_id,name,country,continent,population,tags,tags_filter,geom) VALUES (' + ','.join(values) + ') ON CONFLICT (seed_id) DO UPDATE SET name=EXCLUDED.name,country=EXCLUDED.country,continent=EXCLUDED.continent,population=EXCLUDED.population,tags=EXCLUDED.tags,tags_filter=EXCLUDED.tags_filter,geom=EXCLUDED.geom;')
        sql.append(f'CREATE INDEX IF NOT EXISTS {name}_geom_index ON public.{name} USING gist (geom);')
        symbol = {'kind': kind, 'stroke': stroke, 'width': 1.4, 'fill': fill, 'fillOpacity': .4 if kind == 'polygon' else 1, 'size': 8}
        (directory / f'styles/{name}.sld').write_text(write_sld(name, [{'symbols': [symbol]}]), encoding='utf-8', newline='\n')
        extent = [min(v[0] for v in xy), min(v[1] for v in xy), max(v[0] for v in xy), max(v[1] for v in xy)]
        manifest['layers'].append({'name': name, 'store': 'demo-data', 'nativeName': name, 'geometry': kind, 'srs': 'EPSG:4326', 'extent': extent, 'featureCount': len(data['features']), 'sld': f'styles/{name}.sld'})
        counts[name] = len(data['features'])
    sql.append('COMMIT;')
    source = directory / 'seed.sql'
    source.write_text('\n'.join(sql) + '\n', encoding='utf-8', newline='\n')
    (directory / 'manifest.json').write_text(json.dumps(manifest, indent=2) + '\n', encoding='utf-8', newline='\n')
    return counts

def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--dry-run', action='store_true')
    parser.add_argument('--url', default='http://localhost:8080/geoserver')
    parser.add_argument('--workspace', default='demo')
    parser.add_argument('--database', default='webgis')
    parser.add_argument('--db-user', default='webgis')
    parser.add_argument('--db-host')
    parser.add_argument('--db-port', type=int, default=5432)
    parser.add_argument('--psql', help='Path to a native psql executable; otherwise use Docker Compose.')
    parser.add_argument('--output-dir', type=Path, default=ROOT / '.cache/geoserver-seed')
    args = parser.parse_args()
    directory = args.output_dir
    host = args.db_host or ('localhost' if args.psql else 'db')
    counts = prepare(directory, args.workspace, args.database, args.db_user, host, args.db_port)
    command = [sys.executable, str(ROOT / 'tools/qgis-to-geoserver/publish_geoserver.py'), str(directory / 'manifest.json'), '--url', args.url]
    if args.dry_run:
        print(json.dumps({'features': counts, 'sql': str(directory / 'seed.sql'), 'manifest': str(directory / 'manifest.json')}))
        subprocess.run(command + ['--dry-run'], check=True)
        return
    env_file = STACK / '.env'
    if env_file.exists():
        for line in env_file.read_text(encoding='utf-8').splitlines():
            if '=' in line and not line.lstrip().startswith('#'):
                key, value = line.split('=', 1)
                os.environ.setdefault(key.strip(), value.strip().strip('"\''))
    sql = (directory / 'seed.sql').read_bytes()
    if args.psql:
        environment = dict(os.environ)
        if not environment.get('PGPASSWORD'):
            raise RuntimeError('Set PGPASSWORD for native psql before running the seed.')
        subprocess.run([args.psql, '--host=' + host, '--port=' + str(args.db_port), '--username=' + args.db_user,
                        '--dbname=' + args.database, '--no-password', '-v', 'ON_ERROR_STOP=1'], env=environment, input=sql, check=True)
    else:
        subprocess.run(['docker', 'compose', 'exec', '-T', 'db', 'psql', '--username=' + args.db_user, '--dbname=' + args.database, '-v', 'ON_ERROR_STOP=1'], cwd=STACK, input=sql, check=True)
    for attempt in range(30):
        try:
            with urlopen(args.url.rstrip('/') + '/wms?service=WMS&request=GetCapabilities', timeout=5) as response:
                if response.status == 200:
                    break
        except OSError:
            if attempt == 29:
                raise RuntimeError('Local GeoServer did not become ready.') from None
            time.sleep(1)
    environment = {**os.environ, 'GEOSERVER_USER': os.environ.get('GEOSERVER_USER') or os.environ.get('GEOSERVER_ADMIN_USER', 'admin')}
    if not environment.get('GEOSERVER_PASSWORD') and os.environ.get('GEOSERVER_ADMIN_PASSWORD'):
        environment['GEOSERVER_PASSWORD'] = os.environ['GEOSERVER_ADMIN_PASSWORD']
    subprocess.run(command, env=environment, check=True)

if __name__ == '__main__':
    main()
