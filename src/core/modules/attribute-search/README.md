# Attribute search

Queries configured fields and cancels superseded requests. One result opens a popup; several open a floating list. Missing geometry remains readable and does not enter extent fitting. Closing the result list removes its map highlights and popup. The block's **Clear** resets input and results; **Clear map** removes results and counts while retaining the entered text. Both cancel pending requests and ignore late responses.

Options: `layer`, `fields`, `match`, `label`, `limit`, `minChars`, `result`, `highlight`, `zoomTo`, `maxZoom`, `showLayerOnSearch`

See [module documentation](../../../../docs/modules/attribute-search.md) and the demo configuration for a working instance. Setup returns a disposable when listeners, layers or panels need teardown.
