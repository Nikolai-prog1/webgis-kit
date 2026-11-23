# Map export

Waits up to 20 seconds for rendering, composes transformed/transparent canvases and annotation text at device density, then adds brand/title/date, scale, north arrow, visible layer legend and credits. PNG is downloadable; Print opens the browser dialog, including PDF output. Tainted images produce proxy help.

Options: Add `print` to `toolbar`; `print` config controls title, logo, north arrow, legend and filename prefix.

See [module documentation](../../../../docs/modules/map-export.md) and the demo configuration for a working instance. Setup returns a disposable when listeners, layers or panels need teardown.
