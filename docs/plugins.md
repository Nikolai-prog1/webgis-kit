# Plugin API

An instance exports an array from `plugins/index.js`; each plugin has `id` and `setup(ctx)`. Register extensions in setup and create map-dependent objects in hooks. See the two demo plugins for safe popup rows and thematic vector styling.

| Context                                                    | Purpose                                                                  |
| ---------------------------------------------------------- | ------------------------------------------------------------------------ |
| `config`, `map`, `view`                                    | Frozen normalized settings and the live OpenLayers objects after startup |
| `t`, `locale`, `localized`                                 | Translation, interpolation and localized config values                   |
| `services.get/wmsUrl/wfsUrl`                               | Named service metadata and resolved endpoints                            |
| `layers.get/all/byCatalog/ensure/setVisible/setOpacity/on` | Definition registry, lazy creation and synchronized state                |
| `query.features/describe/distinct`                         | Uniform local/CQL/FES access with cancellation                           |
| `ui.sidebar.registerBlock`, `ui.toolbar.registerTool`      | Instance UI extensions                                                   |
| `ui.header.addEnd`, `ui.panels.create`                     | Header elements and reusable floating windows                            |
| `ui.popup.show/showFeature/close/registerFormatter`        | Escaped row-based popups; HTML is a trusted-code escape hatch            |
| `ui.toast`, `ui.loading.begin/end`                         | User feedback and balanced loading counts                                |
| `tools.activate/deactivate/active`, `clicks.register`      | Exclusive tools and prioritized map clicks                               |
| `hooks.on/emit/emitAsync`                                  | Lifecycle and data extensions                                            |
| `storage.get/set/remove`, `crs.list/format/parse`          | Optional prefixed storage and configured coordinates                     |

`config:loaded` runs after plugin registration and before freezing. `app:beforeStart` is asynchronous. `layer:created` receives `{def, layer}`. `identify:result` can consume a result by returning true. `search:results` and `filter:results` can return a replacement feature array. `export:compose` receives `{sheet}` with canvas/context, map rectangle and attributions. `app:ready` receives the context. Hook registration returns an unsubscribe function.

Sidebar factories receive `(ctx, options, mount)` and may return `dispose()`. Toolbar tools provide an ID, icon, label, callbacks, `exclusive` flag and optional popover. Register click handlers with an ID and priority; return true when consumed. The active tool runs at 100, query results at 50 and identify at 0. Close UI and remove listeners/layers during disposal. Treat feature properties as text; a formatter normally returns `{title, rows}`. Never pass user properties directly to raw HTML.

Grouped search/filter features also use the layer's registered popup formatter. Read the original feature array from `feature.get('_wgRows')` and its count from `_wgCount`; without a formatter, the built-in group popup shows result titles, subtitles and `result.fields`. External instance plugins may import `ol/...` and `proj4` directly: Vite resolves one shared copy from the Kit dependencies.
