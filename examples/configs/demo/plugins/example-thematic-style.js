import Style from 'ol/style/Style.js';
import Fill from 'ol/style/Fill.js';
import Stroke from 'ol/style/Stroke.js';
export default {
  id: 'thematic-styles',
  setup(ctx) {
    ctx.hooks.on('layer:created', ({ def, layer }) => {
      if (!['population-theme', 'region-theme'].includes(def.id)) return;
      const styles = new Map();
      const regions = {
        Africa: '#4A8BDF',
        Asia: '#B9D4F3',
        Europe: '#A0006D',
        'North America': '#7E72C4',
        'South America': '#D188B9',
        Oceania: '#D8ECFA',
      };
      layer.setStyle((feature) => {
        const population = Number(feature.get('population'));
        const color =
          def.id === 'population-theme'
            ? population > 100000000
              ? '#A0006D'
              : population > 10000000
                ? '#4A8BDF'
                : '#EFFAFD'
            : regions[feature.get('continent')] || '#EFFAFD';
        if (!styles.has(color))
          styles.set(
            color,
            new Style({
              fill: new Fill({ color }),
              stroke: new Stroke({ color: '#fff', width: 1 }),
            }),
          );
        return styles.get(color);
      });
    });
  },
};
