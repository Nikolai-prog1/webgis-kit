# Deployment

For an isolated local Windows lab without administrator rights or Docker, use the [portable GeoServer/PostGIS recipe](recipes/windows-portable-geoserver.md). It includes native seeding and loopback-only startup.

Build from the selected instance with `npm run build`. Serve the contents of `dist/`, including configuration, data, local fonts/icons, licenses and the proxy help guide. Relative assets support a subdirectory; redirect its slashless URL to the directory form. Edit deployed `config/app.json` and catalogs without rebuilding. Plugin/theme changes require a new build. Configure HTTP caching so configuration updates can be revalidated.

## Static files

Use static hosting for local GeoJSON and public CORS services. Point the host at `dist/`; there is no application server. Preserve the complete output tree. For a subdirectory, publish it as `/gis/` and visit that URL with its trailing slash. Backend URLs must be reachable by the browser or a separately configured proxy.

## Nginx and service proxy

Copy distribution contents into `/srv/www/gis/`. A small server example forwards only the GIS service endpoints; adjust the host, paths and backend origin for your environment:

```nginx
server {
    listen 80;
    server_name example.com;
    root /srv/www;
    index index.html;

    location = /gis { return 301 /gis/; }
    location ~ ^/gis/geoserver/((?:[A-Za-z0-9_.-]+/)?(?:wms|wfs|ows))$ {
        proxy_pass http://127.0.0.1:8080/geoserver/$1$is_args$args;
        proxy_set_header Host $host;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
    location /gis/geoserver/ { return 404; }
    location /gis/ { try_files $uri $uri/ =404; }
}
```

Use `services.main.url: geoserver` in runtime JSON. Keep backend authorization in place; a proxy does not grant data permissions. Add TLS through your normal hosting configuration. Set GeoServer's public proxy base URL when capabilities contain backend legend links. See the [Nginx proxy reference](https://nginx.org/en/docs/http/ngx_http_proxy_module.html#proxy_pass).

## IIS with URL Rewrite and ARR

Create an IIS application at `/gis` pointing to the distribution directory. Install URL Rewrite and Application Request Routing and enable ARR's server-level proxy setting. Put this `web.config` in that application's directory:

```xml
<?xml version="1.0" encoding="utf-8"?>
<configuration>
  <system.webServer>
    <rewrite>
      <rules>
        <rule name="GIS service" stopProcessing="true">
          <match url="^geoserver/((?:[A-Za-z0-9_.-]+/)?(?:wms|wfs|ows))$" />
          <action type="Rewrite" url="http://localhost:8080/geoserver/{R:1}" appendQueryString="true" />
        </rule>
      </rules>
    </rewrite>
    <staticContent>
      <remove fileExtension=".geojson" />
      <mimeMap fileExtension=".geojson" mimeType="application/geo+json" />
      <remove fileExtension=".woff2" />
      <mimeMap fileExtension=".woff2" mimeType="font/woff2" />
    </staticContent>
  </system.webServer>
</configuration>
```

The runtime service URL is again relative `geoserver`. Edit the deployed config directory directly, and retain server authorization/TLS policies. The rewrite rule does not expose the server's administration paths. See [Microsoft's ARR/rewrite guide](https://learn.microsoft.com/en-us/iis/extensions/url-rewrite-module/reverse-proxy-with-url-rewrite-v2-and-application-request-routing).

## Temporary preview and Windows service

`npm run preview -- --port 4173 --strictPort` verifies a local build and uses the same configured development proxy. It is a temporary inspection server; use IIS/Nginx or another supported static host for permanent service.

If a controlled lab needs preview as a Windows service, use a service wrapper such as WinSW; `sc.exe` cannot turn a normal Node process into a service by itself. Place a WinSW executable named `WebGisPreview.exe` next to `WebGisPreview.xml` and the checkout directory. Example XML:

```xml
<service>
  <id>webgis-preview</id>
  <name>WebGIS local preview</name>
  <description>Temporary loopback preview for a built map.</description>
  <executable>%ProgramFiles%\nodejs\node.exe</executable>
  <arguments>node_modules\vite\bin\vite.js preview --host 127.0.0.1 --port 4173 --strictPort</arguments>
  <workingdirectory>%BASE%\webgis-kit</workingdirectory>
  <logpath>%BASE%\logs</logpath>
</service>
```

Adjust the Node/checkout paths. From an administrator terminal, `WebGisPreview.exe install`, then `WebGisPreview.exe start` installs/starts this explicit lab service; use `stop` and `uninstall` when finished. See [WinSW configuration](https://github.com/winsw/winsw/blob/v3/docs/xml-config-file.md). Wrapper installation, IIS, Nginx and Docker execution were not verified on the development machine.
