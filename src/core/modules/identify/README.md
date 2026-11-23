# Identify and popup

The popup has a **Close** button. **Clear map** closes it and cancels pending click/hover requests so a late response cannot reopen it or restore the hover cursor.

Runs after higher-priority clicks and skips active exclusive tools. Visible queryable layers are tested from top to bottom; first result wins. WMS tries JSON, GML and plain text. Popup values are escaped, formatted and copyable.

Options: `identify.enabled`, `featureCount`, `buffer`, `hoverCursor`; layer `queryable`, `popup`, `fields`. Example: the demo Cities layer.

See [module documentation](../../../../docs/modules/identify.md) and the demo configuration for a working instance. Setup returns a disposable when listeners, layers or panels need teardown.
