# Identify and popup

A valid empty FeatureCollection ends format negotiation for that layer. GML and plain-text fallbacks run only after an error, OGC exception or unreadable response; an empty map click therefore makes one successful request per visible queryable WMS layer.

The popup has a **Close** button. **Clear map** closes it and cancels pending click/hover requests so a late response cannot reopen it or restore the hover cursor.

Runs after higher-priority clicks and skips active exclusive tools. Visible queryable layers are tested from top to bottom; first result wins. WMS tries JSON, GML and plain text. Popup values are escaped, formatted and copyable.

## Options and example

`identify.enabled`, `featureCount`, `buffer`, `hoverCursor`; layer `queryable`, `popup`, `fields`. Example: the demo Cities layer.

See the complete working demo configuration in `examples/configs/demo/static/config/app.json`.
