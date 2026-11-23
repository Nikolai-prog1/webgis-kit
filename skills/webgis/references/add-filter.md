# Add attribute filtering

An `attribute-filter` block combines controls with AND. Ranges accept decimal commas; `select` can use explicit values or `auto`; text uses the search matching modes. Add `nullLabel` to expose missing values.

```json
{
  "type": "attribute-filter",
  "layer": "countries",
  "limit": 500,
  "controls": [
    { "type": "range", "field": "population", "label": "Population" },
    {
      "type": "select",
      "field": "continent",
      "label": "Continent",
      "values": "auto"
    }
  ],
  "result": { "title": "{name}", "subtitle": "{continent}" }
}
```

For a delimiter-separated source field, `multiValue.separator` splits distinct display values; `filterField` must contain token-wrapped values such as `|east|west|`, and `wrap` defaults to `|`. Confirm that field exists in the service; configuring it does not create it. `groupBy.field` collapses rows to a representative point and preserves the group's rows for the list/popup. Use `filter:results` in a plugin for deployment-specific deduplication. Verify unfiltered, restrictive, empty and cleared results.
