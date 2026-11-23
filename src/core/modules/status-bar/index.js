import ScaleLine from 'ol/control/ScaleLine.js';
import { unByKey } from 'ol/Observable.js';
import { el } from '../../ui/dom.js';
export default {
  id: 'status-bar',
  kind: 'global',
  setup(ctx) {
    const host = el('div', { class: 'wg-status__coordinates' });
    ctx.shell.status.append(host);
    const update = (coordinate) => {
      host.replaceChildren();
      for (const code of ctx.config.statusBar.coordinates) {
        const definition = ctx.crs.list().find((item) => item.code === code);
        host.append(
          el('span', {
            text: `${ctx.localized(definition.label || code)} ${ctx.crs.format(coordinate, code)}`,
          }),
        );
      }
    };
    update(ctx.view.getCenter());
    const key = ctx.map.on('pointermove', (event) => update(event.coordinate));
    const scale = ctx.config.statusBar.scaleLine
      ? new ScaleLine({
          target: ctx.shell.status,
          bar: false,
          units: 'metric',
          minWidth: 80,
        })
      : null;
    if (scale) ctx.map.addControl(scale);
    return {
      dispose() {
        unByKey(key);
        if (scale) ctx.map.removeControl(scale);
        host.remove();
      },
    };
  },
};
