# Configuration reference

Generated from the shipped JSON Schemas. Run `npm run reference` after changing a schema. URL paths resolve against the page directory; all map extents use longitude/latitude unless explicitly marked otherwise. Editor `$schema` paths are ignored at runtime.

## Application

| Field | Type | Required |
| --- | --- | --- |
| `$schema` | string | no |
| `version` | `1` | yes |
| `app` | object | yes |
| `app.id` | string | yes |
| `app.title` | string or object | yes |
| `app.locale` | `en`, `bg` | no |
| `app.locales` | array | no |
| `app.locales[]` | `en`, `bg` | no |
| `branding` | object | no |
| `branding.logo` | string | no |
| `branding.title` | string or object | no |
| `branding.subtitle` | string or object | no |
| `branding.favicon` | string | no |
| `branding.credit` | object | no |
| `branding.credit.text` | string or object | no |
| `branding.credit.url` | string | no |
| `links` | array | no |
| `links[]` | object | no |
| `links[].title` | string or object | yes |
| `links[].url` | string | yes |
| `links[].icon` | string | no |
| `links[].image` | string | no |
| `map` | object | yes |
| `map.center` | array | yes |
| `map.center[]` | any | no |
| `map.zoom` | number | yes |
| `map.minZoom` | number | no |
| `map.maxZoom` | number | no |
| `map.extent` | array or null | no |
| `map.extent[]` | number | no |
| `map.homeExtent` | array or null | no |
| `map.homeExtent[]` | number | no |
| `crs` | array | no |
| `crs[]` | object | no |
| `crs[].code` | string | yes |
| `crs[].label` | string or object | no |
| `crs[].kind` | `geographic`, `projected` | yes |
| `crs[].decimals` | integer | no |
| `crs[].proj4` | string | no |
| `crs[].bbox` | array or null | no |
| `crs[].bbox[]` | number | no |
| `crs[].worldBbox` | array or null | no |
| `crs[].worldBbox[]` | number | no |
| `crs[].axisOrder` | `en`, `ne` | no |
| `crs[].axisLabels` | array | no |
| `crs[].axisLabels[]` | string | no |
| `services` | object | no |
| `services.*` | object | no |
| `services.*.type` | `geoserver`, `wms`, `wfs` | yes |
| `services.*.url` | string | yes |
| `services.*.workspace` | string | no |
| `services.*.wmsVersion` | string | no |
| `services.*.wfsVersion` | string | no |
| `services.*.serverType` | string | no |
| `services.*.projection` | string | no |
| `services.*.featureNS` | string | no |
| `services.*.title` | string or object | no |
| `basemaps` | object | no |
| `basemaps.default` | string | no |
| `basemaps.allowNone` | boolean | no |
| `basemaps.opacityControl` | boolean | no |
| `basemaps.items` | array | no |
| `basemaps.items[]` | object | no |
| `basemaps.items[].id` | string | yes |
| `basemaps.items[].type` | `osm`, `xyz`, `wms` | yes |
| `basemaps.items[].title` | string or object | yes |
| `basemaps.items[].url` | string | no |
| `basemaps.items[].attribution` | string or object | no |
| `basemaps.items[].service` | string | no |
| `basemaps.items[].layers` | string | no |
| `basemaps.items[].style` | string | no |
| `basemaps.items[].maxZoom` | number | no |
| `layers` | array | no |
| `layers[]` | object | no |
| `layers[].id` | string | yes |
| `layers[].title` | string or object | yes |
| `layers[].geometry` | `point`, `line`, `polygon`, `raster` | no |
| `layers[].source` | object | yes |
| `layers[].source.type` | `wms`, `geojson`, `wfs`, `xyz` | yes |
| `layers[].source.service` | string | no |
| `layers[].source.url` | string | no |
| `layers[].source.layers` | string | no |
| `layers[].source.typeName` | string | no |
| `layers[].source.dataProjection` | string | no |
| `layers[].source.strategy` | `bbox`, `all` | no |
| `layers[].source.attribution` | string or object | no |
| `layers[].source.style` | string or null | no |
| `layers[].source.labelStyle` | string or null | no |
| `layers[].source.tiled` | boolean | no |
| `layers[].source.params` | object | no |
| `layers[].source.projection` | string or null | no |
| `layers[].source.hidpi` | boolean | no |
| `layers[].source.emptyOnException` | array | no |
| `layers[].source.emptyOnException[]` | string | no |
| `layers[].source.scaleCompensation` | boolean | no |
| `layers[].source.maxFeatures` | integer | no |
| `layers[].query` | object | no |
| `layers[].query.service` | string | yes |
| `layers[].query.typeName` | string | yes |
| `layers[].visible` | boolean | no |
| `layers[].queryable` | boolean | no |
| `layers[].table` | boolean | no |
| `layers[].opacity` | number | no |
| `layers[].zIndex` | number or null | no |
| `layers[].minScale` | number or null | no |
| `layers[].maxScale` | number or null | no |
| `layers[].extent` | array or null | no |
| `layers[].extent[]` | number | no |
| `layers[].style` | object | no |
| `layers[].style.fill` | string | no |
| `layers[].style.fillOpacity` | number | no |
| `layers[].style.stroke` | string | no |
| `layers[].style.strokeWidth` | number | no |
| `layers[].style.dasharray` | array or null | no |
| `layers[].style.dasharray[]` | number | no |
| `layers[].style.radius` | number | no |
| `layers[].style.shape` | `circle`, `square`, `triangle`, `diamond` | no |
| `layers[].style.label` | object | no |
| `layers[].style.label.field` | string | yes |
| `layers[].style.label.size` | number | no |
| `layers[].style.label.color` | string | no |
| `layers[].style.label.halo` | string | no |
| `layers[].style.label.minZoom` | number | no |
| `layers[].legend` | `auto` or array | no |
| `layers[].fields` | object | no |
| `layers[].fields.*` | object | no |
| `layers[].fields.*.label` | string or object | no |
| `layers[].fields.*.format` | `text`, `number`, `id`, `date`, `link` | no |
| `layers[].fields.*.hidden` | boolean | no |
| `layers[].fields.*.order` | number | no |
| `layers[].popup` | object | no |
| `layers[].popup.title` | string or object | no |
| `layers[].popup.fields` | array | no |
| `layers[].popup.fields[]` | string | no |
| `layers[].popup.formatter` | string or null | no |
| `layers[].note` | string or object | no |
| `layers[].provider` | string or object | no |
| `layers[].attribution` | string or object | no |
| `catalogs` | array | no |
| `catalogs[]` | object | no |
| `catalogs[].id` | string | yes |
| `catalogs[].title` | string or object | yes |
| `catalogs[].src` | string | no |
| `catalogs[].type` | `wms-capabilities` | no |
| `catalogs[].service` | string | no |
| `catalogs[].include` | array | no |
| `catalogs[].include[]` | string | no |
| `catalogs[].exclude` | array | no |
| `catalogs[].exclude[]` | string | no |
| `catalogs[].titles` | object | no |
| `catalogs[].titles.*` | string or object | no |
| `catalogs[].lazy` | boolean | no |
| `sidebar` | array | no |
| `sidebar[]` | object | no |
| `sidebar[].id` | string | yes |
| `sidebar[].title` | string or object | yes |
| `sidebar[].icon` | string | no |
| `sidebar[].open` | boolean | no |
| `sidebar[].blocks` | array | yes |
| `sidebar[].blocks[]` | object | no |
| `sidebar[].blocks[].type` | string | yes |
| `sidebar[].blocks[].layer` | string | no |
| `sidebar[].blocks[].catalog` | string | no |
| `sidebar[].blocks[].match` | `contains`, `startsWith`, `equals` | no |
| `sidebar[].blocks[].label` | string or object | no |
| `sidebar[].blocks[].placeholder` | string or object | no |
| `sidebar[].blocks[].note` | string or object | no |
| `sidebar[].blocks[].content` | string or object | no |
| `sidebar[].blocks[].layers` | array | no |
| `sidebar[].blocks[].layers[]` | string | no |
| `sidebar[].blocks[].fields` | array | no |
| `sidebar[].blocks[].fields[]` | string | no |
| `sidebar[].blocks[].limit` | integer | no |
| `sidebar[].blocks[].minChars` | integer | no |
| `sidebar[].blocks[].result` | object | no |
| `sidebar[].blocks[].result.title` | string or object | no |
| `sidebar[].blocks[].result.subtitle` | string or object | no |
| `sidebar[].blocks[].result.fields` | array | no |
| `sidebar[].blocks[].result.fields[]` | string | no |
| `sidebar[].blocks[].highlight` | object | no |
| `sidebar[].blocks[].highlight.labelField` | string | no |
| `sidebar[].blocks[].zoomTo` | boolean | no |
| `sidebar[].blocks[].maxZoom` | number | no |
| `sidebar[].blocks[].showLayerOnSearch` | boolean | no |
| `sidebar[].blocks[].controls` | array | no |
| `sidebar[].blocks[].controls[]` | object | no |
| `sidebar[].blocks[].controls[].type` | `range`, `select`, `text` | yes |
| `sidebar[].blocks[].controls[].field` | string | yes |
| `sidebar[].blocks[].controls[].label` | string or object | no |
| `sidebar[].blocks[].controls[].values` | `auto` or array | no |
| `sidebar[].blocks[].controls[].nullLabel` | string or object or null | no |
| `sidebar[].blocks[].controls[].match` | `contains`, `startsWith`, `equals` | no |
| `sidebar[].blocks[].controls[].multiValue` | object | no |
| `sidebar[].blocks[].controls[].multiValue.separator` | string | yes |
| `sidebar[].blocks[].controls[].multiValue.filterField` | string | no |
| `sidebar[].blocks[].controls[].multiValue.wrap` | string | no |
| `sidebar[].blocks[].groupBy` | object or null | no |
| `sidebar[].blocks[].groupBy.field` | string | yes |
| `sidebar[].blocks[].groupBy.countLabel` | string or object | no |
| `toolbar` | array | no |
| `toolbar[]` | string | no |
| `statusBar` | object | no |
| `statusBar.coordinates` | array | no |
| `statusBar.coordinates[]` | string | no |
| `statusBar.scaleLine` | boolean | no |
| `identify` | object | no |
| `identify.enabled` | boolean | no |
| `identify.featureCount` | integer | no |
| `identify.buffer` | number | no |
| `identify.hoverCursor` | boolean | no |
| `print` | object | no |
| `print.defaultTitle` | string or object | no |
| `print.showLogo` | boolean | no |
| `print.northArrow` | boolean | no |
| `print.legend` | boolean | no |
| `print.filenamePrefix` | string | no |
| `messages` | object | no |
| `messages.*` | object | no |
| `messages.*.*` | string | no |

## Catalog

| Field | Type | Required |
| --- | --- | --- |
| `$schema` | string | no |
| `defaults` | object | no |
| `groups` | array | yes |
| `groups[]` | object | no |
| `groups[].id` | string | yes |
| `groups[].title` | string or object | yes |
| `groups[].exclusive` | boolean | no |
| `groups[].selectAll` | boolean | no |
| `groups[].hint` | string or object | no |
| `groups[].opacity` | number | no |
| `groups[].layers` | array | yes |
| `groups[].layers[]` | object | no |
| `groups[].layers[].id` | string | yes |
| `groups[].layers[].title` | string or object | yes |
| `groups[].layers[].geometry` | `point`, `line`, `polygon`, `raster` | no |
| `groups[].layers[].source` | object | yes |
| `groups[].layers[].source.type` | `wms`, `geojson`, `wfs`, `xyz` | no |
| `groups[].layers[].source.service` | string | no |
| `groups[].layers[].source.url` | string | no |
| `groups[].layers[].source.layers` | string | no |
| `groups[].layers[].source.typeName` | string | no |
| `groups[].layers[].source.dataProjection` | string | no |
| `groups[].layers[].source.strategy` | `bbox`, `all` | no |
| `groups[].layers[].source.attribution` | string or object | no |
| `groups[].layers[].source.style` | string or null | no |
| `groups[].layers[].source.labelStyle` | string or null | no |
| `groups[].layers[].source.tiled` | boolean | no |
| `groups[].layers[].source.params` | object | no |
| `groups[].layers[].source.projection` | string or null | no |
| `groups[].layers[].source.hidpi` | boolean | no |
| `groups[].layers[].source.emptyOnException` | array | no |
| `groups[].layers[].source.emptyOnException[]` | string | no |
| `groups[].layers[].source.scaleCompensation` | boolean | no |
| `groups[].layers[].source.maxFeatures` | integer | no |
| `groups[].layers[].query` | object | no |
| `groups[].layers[].query.service` | string | yes |
| `groups[].layers[].query.typeName` | string | yes |
| `groups[].layers[].visible` | boolean | no |
| `groups[].layers[].queryable` | boolean | no |
| `groups[].layers[].table` | boolean | no |
| `groups[].layers[].opacity` | number | no |
| `groups[].layers[].zIndex` | number or null | no |
| `groups[].layers[].minScale` | number or null | no |
| `groups[].layers[].maxScale` | number or null | no |
| `groups[].layers[].extent` | array or null | no |
| `groups[].layers[].extent[]` | number | no |
| `groups[].layers[].style` | object | no |
| `groups[].layers[].style.fill` | string | no |
| `groups[].layers[].style.fillOpacity` | number | no |
| `groups[].layers[].style.stroke` | string | no |
| `groups[].layers[].style.strokeWidth` | number | no |
| `groups[].layers[].style.dasharray` | array or null | no |
| `groups[].layers[].style.dasharray[]` | number | no |
| `groups[].layers[].style.radius` | number | no |
| `groups[].layers[].style.shape` | `circle`, `square`, `triangle`, `diamond` | no |
| `groups[].layers[].style.label` | object | no |
| `groups[].layers[].style.label.field` | string | yes |
| `groups[].layers[].style.label.size` | number | no |
| `groups[].layers[].style.label.color` | string | no |
| `groups[].layers[].style.label.halo` | string | no |
| `groups[].layers[].style.label.minZoom` | number | no |
| `groups[].layers[].legend` | `auto` or array | no |
| `groups[].layers[].fields` | object | no |
| `groups[].layers[].fields.*` | object | no |
| `groups[].layers[].fields.*.label` | string or object | no |
| `groups[].layers[].fields.*.format` | `text`, `number`, `id`, `date`, `link` | no |
| `groups[].layers[].fields.*.hidden` | boolean | no |
| `groups[].layers[].fields.*.order` | number | no |
| `groups[].layers[].popup` | object | no |
| `groups[].layers[].popup.title` | string or object | no |
| `groups[].layers[].popup.fields` | array | no |
| `groups[].layers[].popup.fields[]` | string | no |
| `groups[].layers[].popup.formatter` | string or null | no |
| `groups[].layers[].note` | string or object | no |
| `groups[].layers[].provider` | string or object | no |
| `groups[].layers[].attribution` | string or object | no |

