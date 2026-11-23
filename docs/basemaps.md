# Basemaps

| Provider                      | License/terms                                 | Credit and limits                                                                                                                                       |
| ----------------------------- | --------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------- |
| No base map                   | Local vectors only                            | Useful without network access                                                                                                                           |
| OpenStreetMap                 | Data ODbL; public tile service policy applies | Keep the source's visible contributor credit; normal interactive use, browser caching, valid Referer; no bulk/offline tile download or uptime guarantee |
| EOX Sentinel-2 cloudless 2016 | CC BY 4.0; provider fair-use terms            | Keep the full configured EOX/Copernicus credit; max zoom 14; newer imagery years have different conditions                                              |
| Own XYZ or WMS                | Your provider's license                       | Supply attribution and verify cross-origin export support                                                                                               |

The default demo starts without a basemap and requires no network. EOX's 2016 tile template and terms were checked before inclusion. See [EOX FAQ](https://cloudless.eox.at/documentation/faq) and [capabilities](https://tiles.maps.eox.at/wmts/1.0.0/WMTSCapabilities.xml). Follow the [OSMF tile policy](https://operations.osmfoundation.org/policies/tiles/) for public OSM tiles. Automated tests replace external tiles with synthetic images. Direct Google tile endpoints are excluded; use only providers whose terms permit your integration.
