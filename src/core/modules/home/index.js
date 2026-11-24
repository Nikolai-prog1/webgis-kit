import { fromLonLat, transformExtent } from 'ol/proj.js';
import { mapZoom } from '../../map/createMap.js';
export default {
  id: 'home',
  kind: 'tool',
  setup(ctx) {
    ctx.ui.toolbar.registerTool({
      id: 'home',
      icon: 'ti-home',
      exclusive: false,
      onActivate() {
        const duration = matchMedia('(prefers-reduced-motion: reduce)').matches
          ? 0
          : 600;
        if (ctx.config.map.homeExtent)
          ctx.view.fit(
            transformExtent(
              ctx.config.map.homeExtent,
              'EPSG:4326',
              ctx.view.getProjection(),
            ),
            { duration, padding: [25, 25, 25, 25] },
          );
        else
          ctx.view.animate({
            center: fromLonLat(ctx.config.map.center, ctx.view.getProjection()),
            zoom: mapZoom(ctx.view, ctx.config.map.zoom),
            duration,
          });
      },
    });
  },
};
