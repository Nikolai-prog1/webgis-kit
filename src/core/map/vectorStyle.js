import Style from 'ol/style/Style.js';
import Fill from 'ol/style/Fill.js';
import Stroke from 'ol/style/Stroke.js';
import Circle from 'ol/style/Circle.js';
import RegularShape from 'ol/style/RegularShape.js';
import Text from 'ol/style/Text.js';
import { asArray } from 'ol/color.js';
export function styleOptions(def) {
  return {
    fill: '#6caaa1',
    fillOpacity: def.geometry === 'polygon' ? 0.22 : 0.9,
    stroke: '#276d62',
    strokeWidth: def.geometry === 'line' ? 2 : 1.2,
    radius: 5,
    shape: 'circle',
    ...def.style,
  };
}
export function vectorStyle(def, view) {
  const options = styleOptions(def);
  const color = asArray(options.fill).slice();
  color[3] = (color[3] ?? 1) * options.fillOpacity;
  const fill = new Fill({ color });
  const stroke = new Stroke({
    color: options.stroke,
    width: options.strokeWidth,
    lineDash: options.dasharray,
  });
  const image =
    options.shape === 'circle'
      ? new Circle({ radius: options.radius, fill, stroke })
      : new RegularShape({
          points: options.shape === 'triangle' ? 3 : 4,
          radius: options.radius,
          angle: options.shape === 'diamond' ? 0 : Math.PI / 4,
          fill,
          stroke,
        });
  const text = new Text({
    font: `${options.label?.size || 11}px Inter`,
    fill: new Fill({ color: options.label?.color || '#203e32' }),
    stroke: new Stroke({ color: options.label?.halo || '#fff', width: 3 }),
    offsetY: -12,
    overflow: true,
  });
  const style = new Style({ fill, stroke, image, text });
  return (feature) => {
    text.setText(
      options.label && view.getZoom() >= (options.label.minZoom || 0)
        ? String(feature.get(options.label.field) ?? '')
        : '',
    );
    return style;
  };
}
