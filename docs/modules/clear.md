# Clear

Deactivates the current exclusive tool, closes toolbar popovers and removes measurements (including unfinished sketches), markers, result/table highlights and the popup. Pending search, filter and identify requests are cancelled so late responses cannot restore cleared results. Search/filter result counts are cleared; their entered criteria are retained. Base and data-layer visibility remain under their own controls.

## Options and example

Add `clear` to `toolbar`; plugins can subscribe to `map:clear`.

See the complete working demo configuration in `examples/configs/demo/static/config/app.json`.
