# Coordinate entry

Successful coordinate entry adds the marker and closes the popover. Invalid input keeps it open with an explanation, allowing correction without reopening the tool.

Parses geographic decimal points/commas, hemisphere notation and projected pairs using configured bounds. Moves to at least zoom 18, bounded by maxZoom, and adds a marker. Errors list accepted systems.

## Options and example

Add `goto-coordinates` to `toolbar`; custom projected systems need `proj4` and `bbox`. See the regional example.

See the complete working demo configuration in `examples/configs/demo/static/config/app.json`.
