# Attribute filter

Combines range/select/text conditions with AND, supports decimal commas, null selection, split multi-values and grouped representative points. Hooks can replace result arrays before display.

Closing the result list removes its map highlights and popup. The block's **Clear** resets the controls and results; **Clear map** removes results and counts while retaining the controls. Both cancel pending feature queries and ignore late responses.

Options: `layer`, `controls`, `limit`, `groupBy`, `result`; auto distinct values report truncation.

See [module documentation](../../../../docs/modules/attribute-filter.md) and the demo configuration for a working instance. Setup returns a disposable when listeners, layers or panels need teardown.
