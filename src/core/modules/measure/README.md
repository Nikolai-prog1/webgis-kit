# Measurement

Distance and area tools draw geodesic results with live labels. Finished results remain after Esc or tool switching. Each finished label has a **× / Remove measurement** button that removes only its geometry, label and export annotation, preserving other measurements and markers. The button works by pointer or keyboard, including while a drawing tool is active. Units adapt to magnitude. **Clear map** stops drawing before removing all geometries and labels, including an unfinished sketch. Space adds a vertex at the map center when focused; Enter finishes a sufficient keyboard sketch.

Options: Add `measure-distance` and/or `measure-area` to `toolbar`. The demo enables both.

See [module documentation](../../../../docs/modules/measure.md) and the demo configuration for a working instance. Setup returns a disposable when listeners, layers or panels need teardown.
