# Plugins

Export an array from `app/plugins/index.js`. Each entry has an `id` and `setup(ctx)`. During setup, register hooks, popup formatters, sidebar blocks and toolbar tools; map-dependent work belongs in `app:ready` or `layer:created`. Use `app:beforeStart` to await an external access gate. Frontend checks do not protect backend data.

The shipped popup example returns `{title, rows}` so property values become text safely. The thematic example changes vector styles through `layer:created` without modifying core. Search/filter hooks can return a replacement feature array. `export:compose` receives the finished sheet canvas/context and attribution list. Dispose listeners and layers when an extension is removed. See `docs/plugins.md` for the context API.
