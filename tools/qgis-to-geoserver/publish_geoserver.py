"""Idempotent, reviewable GeoServer publication using only the standard library."""
import argparse
import base64
import copy
import getpass
import json
import os
import re
from pathlib import Path
from urllib.error import HTTPError
from urllib.parse import quote, urlencode, urlsplit
from urllib.request import Request, urlopen
from xml.etree import ElementTree as ET

class PublishError(RuntimeError):
    pass

def validate_url(url):
    parsed = urlsplit(url)
    if parsed.scheme not in ('http', 'https') or not parsed.hostname or parsed.username or parsed.query or parsed.fragment:
        raise ValueError('Provide an HTTP(S) GeoServer base URL without credentials or query parameters.')
    return url.rstrip('/')

def valid_name(value):
    if not re.fullmatch(r'[A-Za-z_][A-Za-z0-9_-]*', value or ''):
        raise ValueError('Resource names must use ASCII letters, digits, underscores or hyphens.')
    return value

def contained_file(root, relative):
    path = (Path(root) / relative).resolve()
    if not path.is_relative_to(Path(root).resolve()) or not path.is_file():
        raise ValueError('Style files must exist inside the manifest directory.')
    return path

def build_plan(manifest, directory, styles_only=False):
    workspace = valid_name(manifest['workspace'])
    ws = quote(workspace, safe='')
    namespace = manifest.get('namespace', f'https://example.com/{workspace}')
    operations = []
    def add(method, path, body=None, **extra):
        operations.append({'method': method, 'path': path, **({'body': body} if body is not None else {}), **extra})
    def ensure(path, collection, body, **extra):
        add('GET', path, allowMissing=True, **extra)
        add('POST', collection, body, whenMissing=path)
    if styles_only:
        add('GET', f'/workspaces/{ws}.json')
    else:
        ensure(f'/workspaces/{ws}.json', '/workspaces', {'workspace': {'name': workspace}})
        ensure(f'/namespaces/{ws}.json', '/namespaces', {'namespace': {'prefix': workspace, 'uri': namespace}}, captureNamespace=True)
        for name, store in manifest.get('stores', {}).items():
            valid_name(name)
            if store.get('type') == 'existing':
                add('GET', f'/workspaces/{ws}/datastores/{quote(name, safe="")}.json')
                continue
            if store.get('type', 'postgis') != 'postgis':
                raise ValueError('Store type must be postgis or existing.')
            params = {'dbtype': 'postgis', 'host': store.get('host', 'localhost'), 'port': str(store.get('port', 5432)),
                      'database': store['database'], 'schema': store.get('schema', 'public'), 'user': store['user'],
                      'namespace': '${namespace}', 'Expose primary keys': 'true'}
            if store.get('passwordEnv'):
                env_name = store['passwordEnv']
                if not re.fullmatch('[A-Z_][A-Z0-9_]*', env_name):
                    raise ValueError('Invalid credential environment variable name.')
                params['passwd'] = '${env:' + env_name + '}'
            payload = {'dataStore': {'name': name, 'enabled': True, 'connectionParameters': {'entry': [{'@key': key, '$': value} for key, value in params.items()]}}}
            ensure(f'/workspaces/{ws}/datastores/{quote(name, safe="")}.json', f'/workspaces/{ws}/datastores', payload)
    seen = set()
    for layer in manifest.get('layers', []):
        name = valid_name(layer['name'])
        if name in seen:
            raise ValueError(f'Duplicate layer: {name}')
        seen.add(name)
        style = valid_name(layer.get('style', name))
        style_file = contained_file(directory, layer['sld'])
        xml = ET.fromstring(style_file.read_text(encoding='utf-8'))
        if xml.get('version') != '1.0.0':
            raise ValueError('Expected an SLD 1.0.0 document.')
        style_path = f'/workspaces/{ws}/styles/{quote(style, safe="")}'
        ensure(style_path + '.json', f'/workspaces/{ws}/styles', {'style': {'name': style, 'filename': style + '.sld'}})
        add('PUT', style_path, file=layer['sld'], contentType='application/vnd.ogc.sld+xml')
        if styles_only:
            continue
        store = valid_name(layer['store'])
        if store not in manifest.get('stores', {}):
            raise ValueError(f'Store {store} is missing from the manifest.')
        collection = f'/workspaces/{ws}/datastores/{quote(store, safe="")}/featuretypes'
        feature_type = {'name': name, 'nativeName': layer.get('nativeName', name), 'title': layer.get('title', name),
                        'srs': layer.get('srs', 'EPSG:4326'), 'projectionPolicy': 'REPROJECT_TO_DECLARED', 'enabled': True}
        ensure(f'{collection}/{quote(name, safe="")}.json', collection, {'featureType': feature_type})
        add('PUT', f'{collection}/{quote(name, safe="")}.json?recalculate=nativebbox,latlonbbox', {'featureType': {'enabled': True}})
        add('PUT', f'/layers/{quote(workspace + ":" + name, safe="")}.json', {'layer': {'enabled': True, 'defaultStyle': {'name': style, 'workspace': workspace}}})
        bbox = list(layer.get('extent', [-180, -80, 180, 80]))
        for low, high in [(0, 2), (1, 3)]:
            if bbox[low] == bbox[high]:
                bbox[low] -= .001
                bbox[high] += .001
        add('GET', f'/{ws}/wms?' + urlencode({'service': 'WMS', 'version': '1.1.1', 'request': 'GetMap', 'layers': f'{workspace}:{name}',
                                      'styles': style, 'srs': 'EPSG:4326', 'bbox': ','.join(map(str, bbox)), 'width': 256, 'height': 256,
                                      'format': 'image/png', 'transparent': 'true'}), endpoint=True, verifyImage=name)
        add('GET', f'/{ws}/wfs?' + urlencode({'service': 'WFS', 'version': '2.0.0', 'request': 'GetFeature', 'typeNames': f'{workspace}:{name}',
                                      'resultType': 'hits'}), endpoint=True, verifyCount=layer.get('featureCount') if layer.get('featureCount', -1) >= 0 else None, layer=name)
    return operations

class Client:
    def __init__(self, url, user, credential):
        self.url = validate_url(url)
        self.authorization = 'Basic ' + base64.b64encode(f'{user}:{credential}'.encode()).decode()

    def request(self, method, path, body=None, content_type='application/json', allow_missing=False, endpoint=False):
        url = self.url + ('' if endpoint else '/rest') + path
        if isinstance(body, dict):
            body = json.dumps(body).encode()
        request = Request(url, data=body, method=method, headers={'Authorization': self.authorization, 'Content-Type': content_type})
        try:
            with urlopen(request, timeout=30) as response:
                return response.status, dict(response.headers), response.read()
        except HTTPError as error:
            if allow_missing and error.code == 404:
                return 404, dict(error.headers), b''
            raise PublishError(f'HTTP {error.code} while requesting {method} {path}') from None

def substitute(value, context):
    if isinstance(value, dict):
        return {key: substitute(item, context) for key, item in value.items()}
    if isinstance(value, list):
        return [substitute(item, context) for item in value]
    if isinstance(value, str) and value.startswith('${env:') and value.endswith('}'):
        name = value[6:-1]
        result = os.environ.get(name)
        if not result:
            result = getpass.getpass(f'Database credential for {name}: ')
        return result
    return context.get('namespace') if value == '${namespace}' else value

def execute_plan(client, plan, directory, namespace=None):
    statuses = {}
    context = {'namespace': namespace or next((op.get('body', {}).get('namespace', {}).get('uri') for op in plan if op.get('body', {}).get('namespace')), None)}
    results = []
    for operation in plan:
        conditional = operation.get('whenMissing')
        if conditional and statuses.get(conditional) != 404:
            continue
        body = substitute(copy.deepcopy(operation.get('body')), context)
        if operation.get('file'):
            body = contained_file(directory, operation['file']).read_bytes()
        status, headers, response = client.request(operation['method'], operation['path'], body,
                                                   operation.get('contentType', 'application/json'),
                                                   operation.get('allowMissing', False), operation.get('endpoint', False))
        statuses[operation['path']] = status
        if operation.get('captureNamespace') and status == 200:
            context['namespace'] = json.loads(response)['namespace']['uri']
        if operation.get('verifyImage'):
            content_type = next((v for k, v in headers.items() if k.lower() == 'content-type'), '')
            if not content_type.startswith('image/') or not response:
                raise PublishError(f'GetMap did not return an image for {operation["verifyImage"]}')
        if operation.get('verifyCount') is not None:
            root = ET.fromstring(response)
            actual = root.get('numberMatched') or root.get('numberOfFeatures')
            if actual is None or actual == 'unknown' or int(actual) != int(operation['verifyCount']):
                raise PublishError(f'Feature count differs for {operation["layer"]}: expected {operation["verifyCount"]}, received {actual}')
        results.append({'method': operation['method'], 'path': operation['path'], 'status': status})
    return results

def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('manifest')
    parser.add_argument('--url', required=True)
    parser.add_argument('--workspace')
    parser.add_argument('--user', default=os.environ.get('GEOSERVER_USER', 'admin'))
    parser.add_argument('--dry-run', action='store_true')
    parser.add_argument('--styles-only', action='store_true')
    args = parser.parse_args()
    validate_url(args.url)
    source = Path(args.manifest).resolve()
    manifest = json.loads(source.read_text(encoding='utf-8'))
    if args.workspace:
        manifest['workspace'] = args.workspace
    plan = build_plan(manifest, source.parent, args.styles_only)
    if args.dry_run:
        # No HTTP requests or credential reads occur in this branch.
        print(json.dumps({'url': args.url, 'operations': plan}, ensure_ascii=False, indent=2))
        return
    credential = os.environ.get('GEOSERVER_PASSWORD') or getpass.getpass('GeoServer credential: ')
    results = execute_plan(Client(args.url, args.user, credential), plan, source.parent, manifest.get('namespace'))
    print(json.dumps({'completed': len(results), 'requests': results}, indent=2))

if __name__ == '__main__':
    main()
