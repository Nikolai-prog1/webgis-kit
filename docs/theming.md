# Theme and brand

Override tokens in `app/theme.css`, which loads last. Available `--wg-*` tokens cover font, accent/strong/soft/on-accent, background/panel/muted surfaces, borders, text/muted, shadows, radii, control height and feedback colors. The demo only overrides the accent palette. Avoid editing core component styles for an instance.

Logo, favicon, header title/subtitle/credit and links are runtime branding settings. Put licensed local assets in `app/static/brand`. Inter Latin/Cyrillic weights 400/500/600 and Tabler webfonts are bundled locally. Icons use valid `ti-*` classes. Check the desktop header, narrow toolbar, mobile drawer, focus ring and contrast after changes. Reduced-motion preferences remove UI animations and map movement durations where used. Documentation screenshots can be regenerated with `npm run screenshots`.
