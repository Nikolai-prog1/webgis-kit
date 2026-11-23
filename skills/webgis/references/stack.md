# Select server architecture

Use `npm run stack -- up --mode none|existing|portable|docker` from the new project. The mode is recorded in ignored `.webgis/project.json`; `status`, `env`, `logs`, `down` inspect and stop it. `--instance <dir>` selects an external instance. `env` shows missing/set flags and never prints credential values.

- **none:** Local GeoJSON for files when no server was requested. No processes are needed.
- **existing:** Reuse supplied connection notes and `.env`. Without credentials, `up` creates blank password placeholders for the user. `status` checks PostGIS and authenticated GeoServer REST; report missing services. No existing passwords/security/data are changed, and `down` leaves these services running.
- **portable:** Windows x64 when a local server was requested and Docker is absent. Official ZIP runtimes are downloaded or reused with `--downloads <dir>`, hashes recorded/checked, an isolated PostgreSQL/PostGIS and GeoServer are created under `.local-stack/`, and free localhost ports are selected. New credentials are randomly generated in `.env`. Do not use an existing server's runtime/data directory.
- **docker:** A separate Compose project using PostgreSQL 17/PostGIS 3.7 and official GeoServer 3.0.2 images. New passwords live in `.env`, ports bind to `127.0.0.1`, named volumes persist through `down`.

Keep `.env`, `.webgis/` and `.local-stack/` ignored. Do not display passwords or request them inline; the user fills existing credentials locally. Stopping a managed stack retains all data. A deployment is a separate audience/network decision, covered by [deploy](deploy.md). After bootstrap, read `<project>/docs/stack.md` for platform behavior and publisher sources; it belongs to the checkout, not the installed skill folder.
