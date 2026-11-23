# External WMS

Declare a service of type `wms` and a catalog of type `wms-capabilities` pointing to its service ID. `include` and `exclude` match names with `*`; `titles` can override display names. The catalog loads lazily and offers retry if discovery fails. For a curated static catalog, run `node tools/wms-to-catalog.mjs <url> --out <file> --service <id> --id <id>` and inspect the result before tracking it.

The browser needs CORS for remote images and queries. When unavailable, use a relative service URL and add a proxy path to the instance's `proxy.json`; put its target in an environment variable. Vite proxy rules serve development and preview only. A deployed static server needs its own reverse proxy. A successful GetCapabilities does not prove GetFeatureInfo, WFS or GetLegendGraphic is supported. Set tables/queryability to match the provider's actual capabilities and usage terms.
