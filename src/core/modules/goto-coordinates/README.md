# Coordinate entry

Parses geographic decimal points/commas, hemisphere notation and projected pairs using configured bounds. Moves to at least zoom 18, bounded by maxZoom, and adds a marker. Errors list accepted systems.

Options: Add `goto-coordinates` to `toolbar`; custom projected systems need `proj4` and `bbox`. See the regional example.

See [module documentation](../../../../docs/modules/goto-coordinates.md) and the demo configuration for a working instance. Setup returns a disposable when listeners, layers or panels need teardown.
