# Troubleshooting

| Symptom                                  | Check                                                                                                                                                                                                            |
| ---------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Map draws but search/table fails         | WMS rendering and WFS queries are separate endpoints and schemas. Confirm typeName, query permission and DescribeFeatureType fields.                                                                             |
| Requested style is missing               | Pass its registered name verbatim; do not add a workspace prefix automatically.                                                                                                                                  |
| Labels need different visibility/order   | Use `labelStyle` as a separate WMS overlay following the main layer. A plugin can add more linked overlays.                                                                                                      |
| Layer disappears when zooming            | Compare SLD scale denominators, inherited service limits and the active catalog's scale hint. GeoServer uses a 0.28 mm pixel for scale.                                                                          |
| WFS pagination mentions natural order    | A table without a primary key needs explicit sorting. The adapter retries using the first described field; prefer a stable key.                                                                                  |
| Export reports a tainted canvas          | A remote image lacks usable CORS. Put it behind a same-origin proxy and preserve required tile attribution and caching behavior.                                                                                 |
| Queries fail across origins              | Configure CORS on the service or use a production reverse proxy. Vite's proxy does not accompany static files automatically.                                                                                     |
| Repeated labels at tile boundaries       | Check TILED and server meta-tiling; use ImageWMS for a single image when appropriate.                                                                                                                            |
| Remove a measurement or temporary result | Use **×** on a finished distance/area label, **Remove** on a marker/coordinate card, **Close** on a result list, or toolbar **Clear map** for all temporary map results. Pending queries are cancelled on clear. |
| Data is displaced or swapped             | Verify declared source CRS, view CRS, proj4 parameters and display/input axis order separately.                                                                                                                  |
| Large vector layers are slow             | Use WMS for display and WFS for selected attributes; add spatial indexes, limits and scale-dependent generalization.                                                                                             |

Inspect the service response rather than saving a confidential fixture in the template. Report a connection you could not verify as unverified.

For a Windows lab without administrator rights or Docker, follow the [portable GeoServer/PostGIS recipe](../../../docs/recipes/windows-portable-geoserver.md). It covers Java temporary-path/loopback problems, PowerShell 5.1 native arguments, separate database ports and native psql seeding.
