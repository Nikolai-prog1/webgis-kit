# Coordinate systems

The parser checks custom projected bounds before EPSG:3857, whose broad world bounds serve as a fallback. When multiple custom systems overlap numerically, their configured order determines priority.

Map center and geographic extents are longitude/latitude in EPSG:4326. The view uses Web Mercator. Add custom `proj4`, `bbox`, `worldBbox`, `axisOrder` and decimal settings to `crs`. Projected coordinate input requires `bbox`, which distinguishes axes and prevents guessing outside a system's supported region. Display `axisOrder: ne` reverses an east/north internal pair; it does not change proj4's coordinate convention.

Use the complete `examples/configs/bulgaria-crs` example for EPSG:7801. Its projection parameters were verified against BKG metadata. Test geographic decimal points, decimal commas, explicit axis labels, hemisphere notation, both projected orders and values outside the bounds. Geographic input without a configured regional bound is interpreted latitude/longitude first.
