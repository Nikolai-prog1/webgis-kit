# Deployment

Run `npm run build`; serve `dist/`. Runtime `config/app.json` and catalog JSON can be edited after deployment without rebuilding. Plugins, themes and bundled code require a new build. Relative asset paths support a subdirectory with a trailing slash.

Choose a recipe in `docs/deployment.md`: static-only hosting for local vectors/public CORS services; Nginx static files plus a service proxy; IIS URL Rewrite with ARR; or temporary `vite preview`. Preview is a development verification server. Production proxies and backend authorization belong to the hosting environment. A repository push, saved source or dry-run is not a verified deployment. Do not change visibility, publish publicly or run protected server writes without the user's authorization.
