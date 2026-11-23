# Branding, theme and language

Put newly licensed logos/favicon assets under `app/static/brand`. Set `branding`, header `links` and `app.title` in the runtime configuration. Text can be a string or a language map; the fallback order is current language, English, first available value. Choose `app.locale` and `app.locales`; `messages` overrides selected translation keys.

Override `--wg-*` variables in `app/theme.css`; core CSS is not an instance customization surface. The demo changes the accent palette only. Core Inter fonts and Tabler icons are bundled locally. Use a valid `ti-*` class from the bundled icon package and check the icon on mobile, where toolbar labels hide. Check contrast, keyboard focus and narrow layouts after changing colors or images.
