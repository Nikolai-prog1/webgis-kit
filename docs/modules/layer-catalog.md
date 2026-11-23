# Layer catalogs

Capabilities catalogs collect direct leaf layers into one group titled after the root layer (or the catalog when the root has no title). Real nested parent layers retain their own groups, so a flat GeoServer workspace does not become one single-item group per layer.

Polygon legend entries may include `hatch: {"color":"#17655b","angle":45,"spacing":6,"width":1}`. The catalog and PNG legend both retain the hatch independently of background fill opacity. Categorized legends print every entry.

A launcher controls master visibility while retaining chosen layers. Closing or minimizing the window preserves selection. Catalog and Active tabs provide filtering, exclusive groups, legends, opacity, extents and scale hints. Capabilities catalogs load lazily with retry.

## Options and example

`catalog` references a declaration; groups use `selectAll`, `exclusive`, `opacity`, `hint` and layer definitions.

```json
{
  "type": "catalog-launcher",
  "catalog": "themes",
  "label": "Open thematic layers"
}
```
