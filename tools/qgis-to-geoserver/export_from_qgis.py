"""Read a configured QGIS group and write neutral SLD, manifest and catalog files.

In the QGIS Python console, import this module and call export_project(config_path).
QGIS imports are deliberately lazy so the SLD writer can be tested without QGIS.
"""
import json
import math
import re
import sys
import unicodedata
from pathlib import Path

MODULE_DIR = Path(__file__).resolve().parent
if str(MODULE_DIR) not in sys.path:
    sys.path.insert(0, str(MODULE_DIR))
from sld import write_sld

def identifier(value):
    value = unicodedata.normalize('NFKD', value).encode('ascii', 'ignore').decode()
    value = re.sub('[^a-zA-Z0-9_]+', '_', value).strip('_').lower()
    if not value or not re.match('[a-z_]', value):
        raise ValueError('Supply an explicit published name in layer_names.')
    return value

def pixels(value, unit='MM', config=None):
    value = float(value or 0)
    unit = str(unit).lower()
    if unit in ('mm', 'millimeters'):
        return value * 96 / 25.4
    if unit in ('point', 'points', 'pt'):
        return value * 96 / 72
    if unit in ('pixel', 'pixels', 'px'):
        return value
    if 'map' in unit:
        scale = (config or {}).get('map_units_per_pixel')
        if not scale or scale <= 0:
            raise ValueError('Map-unit symbols require map_units_per_pixel in export configuration.')
        return value / scale
    raise ValueError(f'Unsupported symbol unit: {unit}')

def color(value, opacity=1):
    parts = str(value).split(',')
    if len(parts) >= 3:
        rgb = [max(0, min(255, round(float(v)))) for v in parts[:3]]
        alpha = float(parts[3]) / 255 if len(parts) > 3 else 1
        return '#%02x%02x%02x' % tuple(rgb), alpha * opacity
    from qgis.PyQt.QtGui import QColor
    parsed = QColor(value)
    return parsed.name(), parsed.alphaF() * opacity

def symbols(symbol, opacity, config, warnings):
    result = []
    for part in symbol.symbolLayers():
        if not part.enabled():
            continue
        kind = part.layerType()
        properties = part.properties()
        alpha = symbol.opacity() * opacity
        if part.hasDataDefinedProperties():
            warnings.append('Data-defined symbol overrides are exported using their static values.')
        if kind in ('SimpleMarker', 'SimpleFill'):
            fill, fill_alpha = color(properties.get('color', '0,0,0,255'), alpha)
            outline, outline_alpha = color(properties.get('outline_color', '0,0,0,255'), alpha)
            desc = {'kind': 'point' if kind == 'SimpleMarker' else 'polygon', 'fill': fill,
                    'fillOpacity': fill_alpha, 'stroke': outline, 'strokeOpacity': outline_alpha,
                    'width': pixels(properties.get('outline_width', .26), properties.get('outline_width_unit', 'MM'), config)}
            if properties.get('outline_style') == 'no':
                desc['strokeOpacity'] = 0
            if kind == 'SimpleMarker':
                shape = properties.get('name', 'circle')
                if shape not in ('circle', 'square', 'triangle', 'diamond', 'star', 'cross', 'x'):
                    warnings.append(f'Marker {shape} is approximated with a circle.')
                    shape = 'circle'
                desc.update(shape=shape, size=pixels(properties.get('size', 2), properties.get('size_unit', 'MM'), config), angle=float(properties.get('angle', 0)))
            else:
                pattern = properties.get('style', 'solid')
                patterns = {'b_diagonal': 'shape://slash', 'f_diagonal': 'shape://backslash',
                            'horizontal': 'shape://horline', 'vertical': 'shape://vertline',
                            'cross': 'shape://plus', 'diagonal_x': 'shape://times'}
                if pattern == 'no':
                    desc['fillOpacity'] = 0
                elif pattern in patterns:
                    desc.update(hatch=patterns[pattern], hatchSize=config.get('hatch_size', 8), hatchWidth=config.get('hatch_width', 1))
                elif pattern != 'solid':
                    warnings.append(f'Brush pattern {pattern} is approximated with a solid fill.')
            result.append(desc)
        elif kind == 'SimpleLine':
            stroke, stroke_alpha = color(properties.get('line_color', '0,0,0,255'), alpha)
            dash = None
            if properties.get('use_custom_dash') == '1':
                dash = [pixels(v, properties.get('customdash_unit', 'MM'), config) for v in properties.get('customdash', '').split(';') if v]
            elif properties.get('line_style') in ('dash', 'dot', 'dash dot', 'dash dot dot'):
                dash = {'dash': [6, 3], 'dot': [1, 3], 'dash dot': [6, 3, 1, 3], 'dash dot dot': [6, 3, 1, 3, 1, 3]}[properties['line_style']]
            result.append({'kind': 'line', 'stroke': stroke, 'strokeOpacity': 0 if properties.get('line_style') == 'no' else stroke_alpha,
                           'width': pixels(properties.get('line_width', .26), properties.get('line_width_unit', 'MM'), config),
                           'dasharray': dash, 'linecap': properties.get('capstyle', 'butt'), 'linejoin': properties.get('joinstyle', 'round')})
        elif kind == 'LinePatternFill':
            sub = symbols(part.subSymbol(), opacity, config, warnings)
            first = sub[0] if sub else {'stroke': '#000000', 'strokeOpacity': alpha, 'width': 1}
            result.append({'kind': 'polygon', 'fill': first['stroke'], 'fillOpacity': first['strokeOpacity'],
                           'hatch': 'shape://horline', 'hatchRotation': float(properties.get('lineangle', properties.get('angle', 0))),
                           'hatchSize': pixels(properties.get('distance', 2), properties.get('distance_unit', 'MM'), config), 'hatchWidth': first['width']})
        else:
            warnings.append(f'Unsupported symbol layer omitted: {kind}.')
    return result

def normalized_value(value):
    if value is None or (hasattr(value, 'isNull') and value.isNull()):
        return None
    if isinstance(value, (list, tuple)):
        return [normalized_value(v) for v in value]
    if isinstance(value, (bool, int, float, str)):
        return value
    return str(value)

def category_condition(layer, attribute, category_value):
    names = [field.name() for field in layer.fields()]
    value = normalized_value(category_value)
    if attribute in names:
        values = value if isinstance(value, list) else [value]
        conditions = [{'field': attribute, 'op': 'eq', 'value': v} for v in values]
    else:
        from qgis.core import QgsExpression, QgsExpressionContext, QgsExpressionContextUtils
        expression = QgsExpression(attribute)
        columns = list(expression.referencedColumns())
        if len(columns) != 1 or columns[0] not in names:
            raise ValueError('Categorized expressions must refer to exactly one source field.')
        context = QgsExpressionContext()
        context.appendScopes(QgsExpressionContextUtils.globalProjectLayerScopes(layer))
        mapped = set()
        for feature in layer.getFeatures():
            context.setFeature(feature)
            if normalized_value(expression.evaluate(context)) == value:
                mapped.add(normalized_value(feature[columns[0]]))
        conditions = [{'field': columns[0], 'op': 'eq', 'value': v} for v in mapped]
        if not conditions:
            return None
    return conditions[0] if len(conditions) == 1 else {'or': conditions}

def layer_rules(layer, config, warnings):
    renderer = layer.renderer()
    kind = renderer.type()
    common = {'minScale': layer.maximumScale() if layer.hasScaleBasedVisibility() else None,
              'maxScale': layer.minimumScale() if layer.hasScaleBasedVisibility() else None}
    rules = []
    if kind == 'singleSymbol':
        rules.append({**common, 'name': 'default', 'title': layer.name(), 'symbols': symbols(renderer.symbol(), layer.opacity(), config, warnings)})
    elif kind == 'categorizedSymbol':
        for index, category in enumerate(renderer.categories()):
            if not category.renderState():
                continue
            otherwise = normalized_value(category.value()) == '' and not category.label()
            where = None if otherwise else category_condition(layer, renderer.classAttribute(), category.value())
            if not otherwise and where is None:
                continue
            rules.append({**common, 'name': f'category-{index + 1}', 'title': category.label(), 'where': where,
                          'else': otherwise, 'symbols': symbols(category.symbol(), layer.opacity(), config, warnings)})
    elif kind == 'graduatedSymbol':
        field = renderer.classAttribute()
        if field not in [f.name() for f in layer.fields()]:
            raise ValueError('Graduated renderers must use a source field.')
        for index, item in enumerate(renderer.ranges()):
            if not item.renderState():
                continue
            parts = []
            if math.isfinite(item.lowerValue()):
                parts.append({'field': field, 'op': 'gte' if index == 0 else 'gt', 'value': item.lowerValue()})
            if math.isfinite(item.upperValue()):
                parts.append({'field': field, 'op': 'lte', 'value': item.upperValue()})
            rules.append({**common, 'name': f'range-{index + 1}', 'title': item.label(), 'where': {'and': parts} if parts else None,
                          'symbols': symbols(item.symbol(), layer.opacity(), config, warnings)})
    else:
        raise ValueError(f'Unsupported renderer: {kind}')
    if not any(rule['symbols'] for rule in rules):
        raise ValueError('No supported enabled symbols remain.')
    return rules

def layer_labels(layer, config, warnings):
    if not layer.labelsEnabled() or not layer.labeling() or not hasattr(layer.labeling(), 'settings'):
        return None
    from qgis.core import QgsUnitTypes
    settings = layer.labeling().settings()
    field = settings.fieldName.strip('"')
    if field not in [f.name() for f in layer.fields()]:
        warnings.append('Expression label omitted; use a source field for portable labels.')
        return None
    text_format = settings.format()
    font = text_format.font()
    size = text_format.size()
    size_unit = QgsUnitTypes.encodeUnit(text_format.sizeUnit())
    buffer = text_format.buffer()
    from qgis.core import QgsWkbTypes
    return {'field': field, 'font': font.family(), 'size': pixels(size, size_unit, config), 'bold': font.bold(), 'italic': font.italic(),
            'color': text_format.color().name(), 'opacity': text_format.opacity() * layer.opacity(),
            'halo': buffer.color().name() if buffer.enabled() else None,
            'haloSize': pixels(buffer.size(), QgsUnitTypes.encodeUnit(buffer.sizeUnit()), config) if buffer.enabled() else 0,
            'line': layer.geometryType() == QgsWkbTypes.LineGeometry,
            'minScale': settings.maximumScale if settings.scaleVisibility else None,
            'maxScale': settings.minimumScale if settings.scaleVisibility else None,
            'vendorOptions': config.get('label_vendor_options', {})}

def export_project(config_path, project=None):
    from qgis.core import QgsProject, QgsMapLayerType, QgsCoordinateReferenceSystem, QgsCoordinateTransform, QgsDataSourceUri
    config_path = Path(config_path).resolve()
    config = json.loads(config_path.read_text(encoding='utf-8'))
    project = project or QgsProject.instance()
    before = (project.fileName(), project.isDirty(), tuple(sorted(project.mapLayers())))
    group = project.layerTreeRoot().findGroup(config['group'])
    if group is None:
        raise ValueError('Configured group does not exist.')
    workspace = identifier(config['workspace'])
    out = Path(config['output_dir'])
    if not out.is_absolute():
        out = config_path.parent / out
    out = out.resolve()
    layers, groups, styles, warnings = [], {}, {}, []
    excluded = set(config.get('exclude_layers', []))
    for tree_layer in group.findLayers():
        layer = tree_layer.layer()
        if layer.type() != QgsMapLayerType.VectorLayer or layer.name() in excluded or layer.id() in excluded:
            continue
        name = identifier(config.get('layer_names', {}).get(layer.name(), layer.name()))
        if name in styles:
            raise ValueError(f'Duplicate published name: {name}')
        own_warnings = []
        rules = layer_rules(layer, config, own_warnings)
        labels = layer_labels(layer, config, own_warnings)
        styles[name] = write_sld(name, rules, labels)
        transform = QgsCoordinateTransform(layer.crs(), QgsCoordinateReferenceSystem('EPSG:4326'), project)
        bounds = transform.transformBoundingBox(layer.extent())
        extent = [bounds.xMinimum(), bounds.yMinimum(), bounds.xMaximum(), bounds.yMaximum()]
        geometry = {0: 'point', 1: 'line', 2: 'polygon'}.get(int(layer.geometryType()))
        if not geometry:
            raise ValueError(f'Unsupported geometry for {name}')
        store = config.get('layer_stores', {}).get(layer.name(), config.get('default_store'))
        if not store:
            raise ValueError('A default_store or layer_stores mapping is required.')
        uri = QgsDataSourceUri(layer.source()) if layer.providerType() == 'postgres' else None
        native_name = config.get('native_names', {}).get(layer.name(), uri.table() if uri else name)
        item = {'name': name, 'title': layer.name(), 'store': store, 'nativeName': native_name, 'srs': layer.crs().authid(),
                'geometry': geometry, 'geometryName': uri.geometryColumn() if uri else 'geom', 'extent': extent,
                'featureCount': layer.featureCount(), 'sld': f'styles/{name}.sld'}
        layers.append(item)
        group_name = tree_layer.parent().name()
        group_id = identifier(config.get('group_names', {}).get(group_name, group_name))
        if group_id not in groups:
            groups[group_id] = {'id': group_id.replace('_', '-'), 'title': group_name, 'selectAll': True, 'layers': []}
        legend = []
        for rule in rules:
            first = rule['symbols'][0] if rule['symbols'] else {}
            legend.append({'label': rule['title'], 'type': geometry, 'fill': first.get('fill'), 'fillOpacity': first.get('fillOpacity', 1),
                           'stroke': first.get('stroke'), 'strokeWidth': first.get('width', 1), 'shape': first.get('shape', 'circle')})
        groups[group_id]['layers'].append({'id': name.replace('_', '-'), 'title': layer.name(), 'geometry': geometry,
                                          'source': {'type': 'wms', 'service': config.get('service_id', 'main'), 'layers': name, 'style': name},
                                          'extent': extent, 'minScale': rules[0].get('minScale'), 'maxScale': rules[0].get('maxScale'),
                                          'visible': bool(config.get('visible', False)), 'queryable': True, 'table': True, 'legend': legend})
        warnings.extend(f'{name}: {message}' for message in own_warnings)
    manifest = {'version': 1, 'workspace': workspace, 'namespace': config.get('namespace', f'https://example.com/{workspace}'),
                'stores': config.get('stores', {}), 'layers': layers, 'warnings': sorted(set(warnings))}
    files = {'manifest.json': json.dumps(manifest, ensure_ascii=False, indent=2) + '\n',
             'catalog.json': json.dumps({'$schema': '../../../../src/core/config/schema/catalog.schema.json', 'groups': list(groups.values())}, ensure_ascii=False, indent=2) + '\n',
             **{f'styles/{name}.sld': text for name, text in styles.items()}}
    if not config.get('overwrite', False) and any((out / name).exists() for name in files):
        raise FileExistsError('Export exists. Choose a new output directory or explicitly enable overwrite.')
    for name, text in files.items():
        target = out / name
        target.parent.mkdir(parents=True, exist_ok=True)
        target.write_text(text, encoding='utf-8', newline='\n')
    assert before == (project.fileName(), project.isDirty(), tuple(sorted(project.mapLayers()))), 'Project changed unexpectedly'
    return {'layers': len(layers), 'output_dir': str(out), 'warnings': manifest['warnings'], 'project_unchanged': True}
