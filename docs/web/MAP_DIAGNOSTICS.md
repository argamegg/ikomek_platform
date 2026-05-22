# Web Map Diagnostics

Use this checklist when map data or map UI looks wrong in the web app.

## Data Sources

- Backend map points come from `/api/map/points`.
- Local district geometry lives in `apps/web-app/src/web/data/districts.geojson`.
- Map-related helpers live under `apps/web-app/src/web/lib` and `apps/web-app/src/web/components/maps`.

## Visual Checks

- District boundaries render at the expected zoom levels.
- Request markers appear inside the expected districts.
- Selected district styles are visible against the base map.
- Empty and loading states are readable.

## Interaction Checks

- Clicking a district updates the analytics panel.
- Clicking a marker opens complaint details.
- Layer controls do not hide the current map context.
- The map remains usable on small laptop widths.

## Debugging Notes

- Check browser console for MapLibre or GeoJSON parse errors.
- Confirm coordinates are stored as longitude and latitude where the map library expects that order.
