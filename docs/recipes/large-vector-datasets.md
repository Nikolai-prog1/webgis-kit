# Large vector datasets

Use WMS for map display and WFS for bounded search, filters and tables. Sending an entire regional dataset as GeoJSON is rarely necessary for a small visible map. On the database, index geometry and query fields, provide a stable primary key for pagination, and use appropriate simplified views/styles by scale.

WFS `strategy: bbox` loads visible vectors with a configured cap; `strategy: all` supports local queries once the bounded dataset is loaded. Query limits are deliberate: table pages use 100 records and CSV uses at most 10,000, with a warning when limited. Distinct lists are capped and indicate truncation. Check source CRS and geometry validity before increasing limits; a projection mismatch can look like slow rendering or an empty layer.
