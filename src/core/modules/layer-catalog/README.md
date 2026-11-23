# Layer catalogs

A launcher controls master visibility while retaining chosen layers. Closing or minimizing the window preserves selection. Catalog and Active tabs provide filtering, exclusive groups, legends, opacity, extents and scale hints. Capabilities catalogs load lazily with retry.

Options: `catalog` references a declaration; groups use `selectAll`, `exclusive`, `opacity`, `hint` and layer definitions.

See [module documentation](../../../../docs/modules/layer-catalog.md) and the demo configuration for a working instance. Setup returns a disposable when listeners, layers or panels need teardown.
