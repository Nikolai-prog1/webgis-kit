# Attribute search

Queries configured fields and cancels superseded requests. One result opens a popup; several open a floating list. Missing geometry remains readable and does not enter extent fitting. Closing the result list removes its map highlights and popup. The block's **Clear** resets input and results; **Clear map** removes results and counts while retaining the entered text. Both cancel pending requests and ignore late responses.

## Options and example

`layer`, `fields`, `match`, `label`, `limit`, `minChars`, `result`, `highlight`, `zoomTo`, `maxZoom`, `showLayerOnSearch`

```json
{
  "type": "attribute-search",
  "layer": "cities",
  "fields": ["name", "country"],
  "label": "Find a city",
  "limit": 25,
  "result": { "title": "{name}", "subtitle": "{country}" },
  "showLayerOnSearch": true
}
```
