# Attribute table

Paging, sorting and search state commit only after a successful response. A WFS/OGC error is shown in a toast while the previous rows, counter and committed CSV query remain intact; retrying requests the intended page or sort again. Natural-order fallback sorting remains available for stores without a stable primary key.

Layer table buttons open reusable bottom panels. Columns come from describe, metadata controls labels/order/visibility. Pages contain 100 rows; sorting, text search, row highlight and UTF-8 BOM CSV are supported. CSV is capped at 10,000 rows and protects formula-like cells.

## Options and example

Layer `table: true` and `fields` metadata. Enable the Cities table in the demo; no separate toolbar entry.

See the complete working demo configuration in `examples/configs/demo/static/config/app.json`.
