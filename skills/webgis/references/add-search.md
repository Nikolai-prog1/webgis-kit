# Add attribute search

Put an `attribute-search` block in a sidebar section. Its `layer` must exist; `fields` must contain actual string field names. Use the layer's local GeoJSON properties or a WFS DescribeFeatureType response to establish the schema. Do not infer field names from layer titles.

```json
{
  "type": "attribute-search",
  "layer": "cities",
  "fields": ["name", "country"],
  "label": "Find a city",
  "match": "contains",
  "limit": 25,
  "minChars": 1,
  "result": { "title": "{name}", "subtitle": "{country}" },
  "highlight": { "labelField": "name" },
  "showLayerOnSearch": true,
  "zoomTo": true,
  "maxZoom": 12
}
```

`contains`, `startsWith` and `equals` control matching. User wildcard characters are literal. Configure the WFS query type separately when it differs from the WMS drawing layer. Test no result, one result, multiple results and clearing; results lacking geometry must remain readable. Add a popup formatter in the instance when rows need custom presentation.

One result opens its popup directly; several results open a floating list. A record without geometry stays in the results and can show its attributes at the current map center, with no attempted extent fit. Clear resets the field and highlights and hides result panels/popups. Reusable panel elements may remain in the DOM; browser checks should assert visibility rather than assume they are removed.
