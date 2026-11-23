"""Small, dependency-free SLD 1.0 writer used by the QGIS adapter and tests."""
from math import isfinite
from xml.etree import ElementTree as ET

SLD = 'http://www.opengis.net/sld'
OGC = 'http://www.opengis.net/ogc'
ET.register_namespace('', SLD)
ET.register_namespace('ogc', OGC)

def element(parent, tag, text=None, namespace=SLD, **attributes):
    node = ET.SubElement(parent, '{' + namespace + '}' + tag, attributes)
    if text is not None:
        node.text = str(text)
    return node

def css(parent, name, value):
    if value is not None:
        element(parent, 'CssParameter', value, name=name)

def condition(parent, where):
    if not where:
        return
    for key in ('and', 'or'):
        if key in where:
            parts = where[key]
            if len(parts) == 1:
                condition(parent, parts[0])
            elif parts:
                group = element(parent, key.title(), namespace=OGC)
                for part in parts:
                    condition(group, part)
            return
    operators = {'eq': 'PropertyIsEqualTo', 'gt': 'PropertyIsGreaterThan',
                 'gte': 'PropertyIsGreaterThanOrEqualTo', 'lte': 'PropertyIsLessThanOrEqualTo'}
    value = where.get('value')
    node = element(parent, 'PropertyIsNull' if value is None else operators[where['op']], namespace=OGC)
    element(node, 'PropertyName', where['field'], namespace=OGC)
    if value is not None:
        element(node, 'Literal', value, namespace=OGC)

def stroke(parent, symbol):
    if symbol.get('stroke') is None or symbol.get('strokeOpacity', 1) <= 0:
        return
    node = element(parent, 'Stroke')
    for name, value in [('stroke', symbol['stroke']), ('stroke-opacity', symbol.get('strokeOpacity', 1)),
                        ('stroke-width', symbol.get('width', 1)), ('stroke-linecap', symbol.get('linecap')),
                        ('stroke-linejoin', symbol.get('linejoin')),
                        ('stroke-dasharray', ' '.join(map(str, symbol['dasharray'])) if symbol.get('dasharray') else None)]:
        css(node, name, value)

def fill(parent, symbol):
    if not symbol.get('fill') or symbol.get('fillOpacity', 1) <= 0:
        return
    node = element(parent, 'Fill')
    if symbol.get('hatch'):
        graphic = element(element(node, 'GraphicFill'), 'Graphic')
        mark = element(graphic, 'Mark')
        element(mark, 'WellKnownName', symbol['hatch'])
        stroke(mark, {'stroke': symbol['fill'], 'strokeOpacity': symbol.get('fillOpacity', 1),
                      'width': symbol.get('hatchWidth', 1)})
        element(graphic, 'Size', symbol.get('hatchSize', 8))
        if symbol.get('hatchRotation'):
            element(graphic, 'Rotation', symbol['hatchRotation'])
    else:
        css(node, 'fill', symbol['fill'])
        css(node, 'fill-opacity', symbol.get('fillOpacity', 1))

def symbolizer(parent, symbol):
    kind = symbol['kind']
    node = element(parent, {'point': 'PointSymbolizer', 'line': 'LineSymbolizer', 'polygon': 'PolygonSymbolizer'}[kind])
    if kind == 'point':
        graphic = element(node, 'Graphic')
        mark = element(graphic, 'Mark')
        shape = symbol.get('shape', 'circle')
        element(mark, 'WellKnownName', 'square' if shape == 'diamond' else shape)
        fill(mark, symbol)
        stroke(mark, symbol)
        element(graphic, 'Size', symbol.get('size', 8))
        angle = symbol.get('angle', 0) + (45 if shape == 'diamond' else 0)
        if angle:
            element(graphic, 'Rotation', angle)
    else:
        if kind == 'polygon':
            fill(node, symbol)
        stroke(node, symbol)

def scales(rule, definition):
    for key, name in [('minScale', 'MinScaleDenominator'), ('maxScale', 'MaxScaleDenominator')]:
        value = definition.get(key)
        if value and isfinite(float(value)):
            element(rule, name, value)

def write_sld(name, rules, labels=None):
    root = ET.Element('{' + SLD + '}StyledLayerDescriptor', {'version': '1.0.0'})
    layer = element(root, 'NamedLayer')
    element(layer, 'Name', name)
    style = element(layer, 'UserStyle')
    element(style, 'Title', name)
    feature_style = element(style, 'FeatureTypeStyle')
    for index, definition in enumerate(rules):
        rule = element(feature_style, 'Rule')
        element(rule, 'Name', definition.get('name', f'rule-{index + 1}'))
        element(rule, 'Title', definition.get('title', definition.get('name', f'Rule {index + 1}')))
        if definition.get('else'):
            element(rule, 'ElseFilter')
        elif definition.get('where'):
            condition(element(rule, 'Filter', namespace=OGC), definition['where'])
        scales(rule, definition)
        for symbol in definition.get('symbols', []):
            symbolizer(rule, symbol)
    if labels:
        rule = element(element(style, 'FeatureTypeStyle'), 'Rule')
        element(rule, 'Name', 'labels')
        scales(rule, labels)
        text = element(rule, 'TextSymbolizer')
        element(element(text, 'Label'), 'PropertyName', labels['field'], namespace=OGC)
        font = element(text, 'Font')
        for key, value in [('font-family', labels.get('font', 'SansSerif')),
                           ('font-size', labels.get('size', 12)),
                           ('font-weight', 'bold' if labels.get('bold') else 'normal'),
                           ('font-style', 'italic' if labels.get('italic') else 'normal')]:
            css(font, key, value)
        placement = element(text, 'LabelPlacement')
        if labels.get('line'):
            element(element(placement, 'LinePlacement'), 'PerpendicularOffset', 0)
        else:
            anchor = element(element(placement, 'PointPlacement'), 'AnchorPoint')
            element(anchor, 'AnchorPointX', 0.5)
            element(anchor, 'AnchorPointY', 0.5)
        if labels.get('halo'):
            halo = element(text, 'Halo')
            element(halo, 'Radius', labels.get('haloSize', 1))
            fill(halo, {'fill': labels['halo']})
        fill(text, {'fill': labels.get('color', '#202e27'), 'fillOpacity': labels.get('opacity', 1)})
        for key, value in labels.get('vendorOptions', {}).items():
            element(text, 'VendorOption', value, name=key)
    ET.indent(root, space='  ')
    return ET.tostring(root, encoding='utf-8', xml_declaration=True).decode('utf-8') + '\n'
