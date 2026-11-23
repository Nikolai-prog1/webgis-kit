# Security

All feature properties and config text are treated as untrusted. Core DOM helpers escape interpolations; raw HTML is an explicit trusted-code escape hatch. Popup rows use text nodes and only HTTP(S) links. Query field names come from configuration or described schema, values are escaped and requests have cancellation/timeouts. CSV escapes cells and prefixes formula-like values.

Do not ship secrets in JSON, plugins, frontend environment variables or source control. Use backend permissions and a reverse proxy or identity service. `app:beforeStart` can await a gate, but a frontend password does not protect WMS/WFS endpoints. The template has no built-in login.

For a production host, start with a CSP like this and replace remote origins with the providers actually configured:

```text
default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; font-src 'self'; img-src 'self' data: blob: https:; connect-src 'self' https:; object-src 'none'; base-uri 'self'; frame-ancestors 'self'
```

Inline styles are needed by OpenLayers positioning and canvas layout; core scripts are external modules. Tighten `img-src` and `connect-src` to approved origins or a same-origin proxy. Development WebSocket rules differ. Preserve tile providers' Referer/caching requirements. The privacy scanner checks tracked content, all Git history and distribution files; optional local rules stay outside the repository. The sole additional public contact allowance preserves an upstream license notice. See root SECURITY.md for reporting.
