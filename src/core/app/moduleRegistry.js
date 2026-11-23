import basemapSwitcher from '../modules/basemap-switcher/index.js';
import layerList from '../modules/layer-list/index.js';
import attributeSearch from '../modules/attribute-search/index.js';
import attributeFilter from '../modules/attribute-filter/index.js';
import layerCatalog from '../modules/layer-catalog/index.js';
import measure from '../modules/measure/index.js';
import marker from '../modules/marker/index.js';
import gotoCoordinates from '../modules/goto-coordinates/index.js';
import home from '../modules/home/index.js';
import clear from '../modules/clear/index.js';
import mapExport from '../modules/map-export/index.js';
import statusBar from '../modules/status-bar/index.js';
import identify from '../modules/identify/index.js';
import attributeTable from '../modules/attribute-table/index.js';
/** @type {any[]} */
export const modules = [
  {
    id: 'text',
    kind: 'block',
    setup(ctx, options, mount) {
      mount.textContent = ctx.localized(options.content);
    },
  },
  basemapSwitcher,
  layerList,
  attributeSearch,
  attributeFilter,
  layerCatalog,
  measure,
  marker,
  gotoCoordinates,
  home,
  clear,
  mapExport,
  statusBar,
  identify,
  attributeTable,
];
export function registerModules(ctx) {
  for (const module of modules)
    if (module.kind === 'block')
      ctx.ui.sidebar.registerBlock(module.id, module.setup);
  for (const id of ctx.config.toolbar) {
    const module = modules.find(
      (module) =>
        module.kind === 'tool' &&
        (module.id === id || module.toolIds?.includes(id)),
    );
    if (!module) throw new Error(`Unknown toolbar tool: ${id}`);
    const disposable = module.setup(ctx, { id });
    if (disposable) ctx.disposables.push(disposable);
  }
  for (const module of modules.filter((module) => module.kind === 'global')) {
    const enabled =
      module.id === 'identify'
        ? ctx.config.identify.enabled
        : module.id === 'attribute-table'
          ? ctx.layers.all().some((entry) => entry.def.table)
          : module.id === 'status-bar'
            ? ctx.config.statusBar.coordinates.length ||
              ctx.config.statusBar.scaleLine
            : false;
    if (enabled) {
      const disposable = module.setup(ctx);
      if (disposable) ctx.disposables.push(disposable);
    }
  }
}
