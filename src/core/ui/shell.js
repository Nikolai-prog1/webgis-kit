import { el, button, safeUrl } from './dom.js';
import { icon } from './icons.js';
/** @param {AppContext} ctx */
export function renderShell(ctx, target) {
  const { config, localized, t } = ctx;
  const sidebar = el('aside', { class: 'wg-sidebar', id: 'wg-sidebar' });
  const map = el('main', {
    class: 'wg-map',
    'aria-label': localized(config.app.title),
    tabIndex: 0,
  });
  const toolbar = el('nav', {
    class: 'wg-toolbar',
    role: 'toolbar',
    'aria-label': localized(config.app.title),
  });
  const headerEnd = el('div', { class: 'wg-header__end' });
  const brand = el('div', { class: 'wg-brand' });
  if (config.branding.logo && safeUrl(config.branding.logo))
    brand.append(
      el('img', {
        src: safeUrl(config.branding.logo),
        alt: '',
        width: 34,
        height: 34,
      }),
    );
  const titles = el(
    'div',
    {},
    el('strong', {
      text: localized(config.branding.title || config.app.title),
    }),
    el('small', { text: localized(config.branding.subtitle) }),
  );
  if (config.branding.credit?.text)
    titles.append(
      el('a', {
        text: localized(config.branding.credit.text),
        href: safeUrl(config.branding.credit.url),
        target: '_blank',
        rel: 'noopener noreferrer',
      }),
    );
  brand.append(titles);
  const menu = button(
    '',
    () => {
      const open = sidebar.classList.toggle('wg-sidebar--open');
      menu.setAttribute('aria-expanded', String(open));
    },
    {
      class: 'wg-menu',
      'aria-label': t('app.menu'),
      'aria-expanded': 'false',
      'aria-controls': sidebar.id,
    },
  );
  menu.append(icon('ti-menu-2'));
  for (const link of config.links) {
    const node = el('a', {
      href: safeUrl(link.url),
      title: localized(link.title),
      'aria-label': localized(link.title),
      target: '_blank',
      rel: 'noopener noreferrer',
      class: 'wg-header__link',
    });
    if (link.image)
      node.append(
        el('img', {
          src: safeUrl(link.image),
          alt: localized(link.title),
          height: 26,
        }),
      );
    else node.append(icon(link.icon || 'ti-external-link'));
    headerEnd.append(node);
  }
  if (config.app.locales.length > 1) {
    const select = el('select', {
      'aria-label': t('app.language'),
      value: ctx.locale,
    });
    config.app.locales.forEach((code) =>
      select.append(
        el('option', {
          value: code,
          text: code.toUpperCase(),
          selected: code === ctx.locale,
        }),
      ),
    );
    select.addEventListener('change', () => {
      ctx.storage.set('locale', select.value);
      const url = new URL(location.href);
      url.searchParams.set('lang', select.value);
      location.assign(url.href);
    });
    headerEnd.append(select);
  }
  const header = el(
    'header',
    { class: 'wg-header' },
    menu,
    brand,
    toolbar,
    headerEnd,
  );
  const workspace = el('div', { class: 'wg-workspace' }, sidebar, map);
  const status = el('div', { class: 'wg-status', 'aria-live': 'off' });
  const panels = el('div', { class: 'wg-panels' });
  const tasks = el('div', { class: 'wg-tasks' });
  map.append(status, panels, tasks);
  target.replaceChildren(header, workspace);
  target.className = 'wg-app';
  document.documentElement.lang = ctx.locale;
  document.title = localized(config.app.title);
  if (config.branding.favicon) {
    let favicon = document.querySelector('link[rel="icon"]');
    if (!favicon) {
      favicon = el('link', { rel: 'icon' });
      document.head.append(favicon);
    }
    favicon.setAttribute('href', safeUrl(config.branding.favicon));
  }
  return { sidebar, map, toolbar, headerEnd, status, panels, tasks };
}
