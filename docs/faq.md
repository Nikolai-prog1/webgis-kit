# Questions

**Can the demo run offline?** Its data, fonts and icons are local. Select no basemap or your own licensed offline service. Public tile providers may prohibit bulk/offline download.

**Can I edit configuration after building?** Yes: edit deployed `config/app.json` and catalog files. Rebuild for plugin, theme or core changes.

**Why does WMS work while the table fails?** WFS access, type names and attribute schemas are separate. Inspect DescribeFeatureType and permissions.

**Where do deployment-specific changes go?** In the instance directory, including its plugins and theme. Avoid core edits so upgrades can preserve your app.

**Why are no results shown for a partial symbol?** Search escapes wildcard characters literally. `contains`, `startsWith` and `equals` choose matching behavior.

**What does coordinate input assume?** Geographic input tries latitude/longitude first and uses configured world bounds to disambiguate. Projected input requires bounds. The regional example demonstrates north/east display with east/north internal values.

**Does a frontend gate secure the data?** No. Protect the backend and proxy with real authorization.
