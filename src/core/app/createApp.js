import { createMap } from '../map/createMap.js';
import { createCrs } from '../map/projections.js';
import { createServices } from '../map/services.js';
import { createBasemaps } from '../map/basemaps.js';
import { createLayerFactory } from '../map/layerFactory.js';
import { createLayerRegistry } from '../map/layerRegistry.js';
import { createToolManager } from '../map/toolManager.js';
import { createClickRouter } from '../map/clickRouter.js';
import { createPopup } from '../ui/popup.js';
import { createFeatureQuery } from '../data/featureQuery.js';
import { createPanels } from '../ui/floatingPanels.js';
import { createToolbar } from '../ui/toolbar.js';
import plugins from '@app/plugins/index.js';
import { loadConfig } from '../config/loadConfig.js';
import { deepFreeze } from '../config/normalize.js';
import { validateLite } from '../config/validateLite.js';
import { createI18n } from '../i18n/index.js';
import { createHooks } from './hooks.js';
import { createStorage } from './storage.js';
import { renderShell } from '../ui/shell.js';
import { createSidebar } from '../ui/sidebar.js';
import { createToast } from '../ui/toast.js';
import { createLoading } from '../ui/loading.js';
import { el, button } from '../ui/dom.js';
import { registerModules } from './moduleRegistry.js';

export async function createApp(target) {
  const fallback = createI18n(
    new URL(location.href).searchParams.get('lang') === 'bg' ? 'bg' : 'en',
  );
  try {
    const config = await loadConfig();
    const storage = createStorage(config.app.id);
    const preferred =
      new URL(location.href).searchParams.get('lang') ||
      storage.get('locale') ||
      config.app.locale;
    const i18n = createI18n(
      config.app.locales.includes(preferred) ? preferred : config.app.locale,
      config.messages,
    );
    /** @type {AppContext} */
    const ctx = {
      config,
      ...i18n,
      storage,
      hooks: createHooks(),
      ui: {},
      annotations: [],
      disposables: [],
    };
    ctx.tools = createToolManager(ctx.hooks);
    const formatters = new Map();
    const blockFactories = new Map();
    const pluginTools = [],
      headerElements = [];
    ctx.ui.popup = {
      registerFormatter: (name, fn) => formatters.set(name, fn),
      formatters,
    };
    ctx.ui.sidebar = {
      registerBlock: (type, factory) => blockFactories.set(type, factory),
    };
    ctx.ui.toolbar = { registerTool: (tool) => pluginTools.push(tool) };
    ctx.ui.header = { addEnd: (element) => headerElements.push(element) };
    for (const plugin of plugins) await plugin.setup(ctx);
    ctx.hooks.emit('config:loaded', config);
    const errors = validateLite(config);
    if (errors.length) throw new Error(errors.join('\n'));
    deepFreeze(config);
    await ctx.hooks.emitAsync('app:beforeStart', ctx);
    const shell = renderShell(ctx, target);
    ctx.shell = shell;
    ctx.ui.toast = createToast(target);
    ctx.ui.loading = createLoading(target, ctx.t('app.loading'));
    ctx.ui.header = { addEnd: (element) => shell.headerEnd.append(element) };
    headerElements.forEach((element) => ctx.ui.header.addEnd(element));
    ctx.crs = createCrs(config, ctx.locale);
    ctx.services = createServices(config);
    Object.assign(ctx, createMap(config, shell.map));
    ctx.basemaps = createBasemaps(ctx);
    ctx.layers = createLayerRegistry(ctx, createLayerFactory(ctx));
    for (const entry of ctx.layers.all())
      if (!entry.def.catalogId || entry.def.visible)
        ctx.layers.ensure(entry.def.id);
    ctx.clicks = createClickRouter(ctx.map);
    ctx.ui.popup = createPopup(ctx, formatters);
    ctx.ui.panels = createPanels(ctx, shell.panels, shell.tasks);
    ctx.query = createFeatureQuery(ctx);
    ctx.ui.toolbar = createToolbar(ctx, shell.toolbar);
    ctx.ui.sidebar = createSidebar(ctx, shell.sidebar);
    registerModules(ctx);
    pluginTools.forEach((tool) => ctx.ui.toolbar.registerTool(tool));
    for (const [type, factory] of blockFactories)
      ctx.ui.sidebar.registerBlock(type, factory);
    ctx.ui.sidebar.render();
    const escape = (event) => {
      if (event.key === 'Escape') ctx.tools.deactivate();
    };
    document.addEventListener('keydown', escape);
    await ctx.hooks.emitAsync('app:ready', ctx);
    ctx.dispose = () => {
      ctx.tools.deactivate();
      document.removeEventListener('keydown', escape);
      ctx.ui.sidebar.dispose();
      ctx.disposables.forEach((item) => item.dispose?.());
      ctx.ui.toolbar.dispose();
      ctx.ui.panels.dispose();
      ctx.clicks.dispose();
      ctx.map.setTarget(null);
      ctx.hooks.clear();
    };
    return ctx;
  } catch (error) {
    target.replaceChildren(
      el(
        'section',
        { class: 'wg-error', role: 'alert' },
        el('h1', { text: fallback.t('app.error') }),
        el('pre', { text: error.message }),
        button(fallback.t('app.retry'), () => location.reload()),
      ),
    );
    return null;
  }
}
