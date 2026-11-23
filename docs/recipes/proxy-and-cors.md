# Proxy and CORS

Remote WMS/XYZ images need usable CORS to keep map export readable. Feature queries need CORS independently. Set a relative service URL in app JSON, declare its proxy path in `proxy.json`, and put the actual target in an ignored environment variable. `stripPrefix` removes the configured local prefix before forwarding; leave it false when the target is an origin expecting the full path.

Vite installs the same proxy for dev and preview. Static deployment does not carry a Node proxy with it: configure Nginx or IIS using the deployment recipes. Verify the resulting URL path once to avoid doubling a service context. Preserve query strings and provider headers. Configure GeoServer's public proxy base URL when capabilities/legend links expose a backend address.

If export reports a SecurityError, identify the remote image, inspect its Access-Control-Allow-Origin response and retry through the same origin. Do not disable browser security. Preserve required attribution, caching and Referer behavior; public tile services may reject anonymous or bulk proxying. This guide is included in distribution output for the export help link.
