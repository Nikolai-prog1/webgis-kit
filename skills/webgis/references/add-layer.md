# Add a layer

For GeoServer, use its base URL plus a `workspace` in the service definition. The Kit scopes WMS to `/{workspace}/wms` and WFS to `/{workspace}/wfs`, keeping layer names qualified and style names unchanged. A URL already containing the workspace is supported; do not append it twice. Omit the workspace only when global services are intended.

Give each layer a unique lowercase, hyphenated ID. Add its definition to `layers`, then include its ID in a `layer-list` block in a sidebar section. Local assets are relative to `app/static/`; do not include `app/static` in the URL.

```json
{
  "id": "libraries",
  "title": "Libraries",
  "geometry": "point",
  "source": { "type": "geojson", "url": "data/libraries.geojson" },
  "visible": true,
  "table": true,
  "popup": { "title": "{name}" }
}
```

For WMS, configure a named service and use `source.type: wms`, `service`, `layers` and optionally `style`/`labelStyle`. The layer name gains a workspace prefix when needed; style names remain verbatim. `tiled: false` uses one ImageWMS image and can reduce repeated labels. WMS attributes require `query.service`/`query.typeName` or the derived WFS type. WFS vector sources use `source.type: wfs`, `service`, `typeName`, `strategy: bbox|all` and `maxFeatures`.

Catalog layers belong in `config/catalogs/*.json` under groups and are created lazily. Add a catalog declaration to `catalogs` and a `catalog-launcher` block to a sidebar section. `legend` accepts symbol entries or `auto` for GetLegendGraphic; vector legends otherwise derive from the style. Check visibility, identify and a table in the browser. See the complete examples and generated schema reference for all options.
