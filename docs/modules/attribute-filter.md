# Attribute filter

Combines range/select/text conditions with AND, supports decimal commas, null selection, split multi-values and grouped representative points. Hooks can replace result arrays before display.

Closing the result list removes its map highlights and popup. The block's **Clear** resets the controls and results; **Clear map** removes results and counts while retaining the controls. Both cancel pending feature queries and ignore late responses.

## Options and example

`layer`, `controls`, `limit`, `groupBy`, `result`; auto distinct values report truncation.

```json
{
  "type": "attribute-filter",
  "layer": "countries",
  "controls": [
    { "type": "range", "field": "population", "label": "Population" },
    {
      "type": "select",
      "field": "continent",
      "label": "Continent",
      "values": "auto"
    }
  ],
  "result": { "title": "{name}" }
}
```
