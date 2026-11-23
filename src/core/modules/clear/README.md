# Clear

Deactivates the current exclusive tool, closes toolbar popovers and removes measurements (including unfinished sketches), markers, result/table highlights and the popup. Pending search, filter and identify requests are cancelled so late responses cannot restore cleared results. Search/filter result counts are cleared; their entered criteria are retained. Base and data-layer visibility remain under their own controls.

Options: Add `clear` to `toolbar`; plugins can subscribe to `map:clear`.

See [module documentation](../../../../docs/modules/clear.md) and the demo configuration for a working instance. Setup returns a disposable when listeners, layers or panels need teardown.
