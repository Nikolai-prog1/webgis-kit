# QGIS publishing

Read `tools/qgis-to-geoserver/README.md` and copy its example export configuration to a private working directory. Set the QGIS group, published names, stores and exclusions there. Export SLD, manifest and catalog; inspect warnings, symbols, scale bounds and field labels. The exporter reads the project without saving it.

Use the publisher's `--dry-run` to review method/path/body operations without network or credentials. Actual publication needs explicit authorization for the target server. Supply credentials only through the environment or getpass prompts. `--styles-only` changes styles in an existing workspace; full publication ensures stores and feature types and verifies images/counts. Keep real connection information and exports out of a shared template. Use ASCII service resource names without spaces; display titles remain localized.
