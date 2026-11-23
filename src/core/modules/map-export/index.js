import { unByKey } from 'ol/Observable.js';
import { getPointResolution } from 'ol/proj.js';
import { el, safeUrl } from '../../ui/dom.js';
import { legendEntries } from '../../ui/legendSymbols.js';
import { download } from '../../ui/download.js';
import { distanceLabel } from '../../map/units.js';
export function wrapText(context, text, width) {
  const lines = [];
  let line = '';
  for (const word of String(text).split(/\s+/)) {
    if (context.measureText(`${line} ${word}`).width > width && line) {
      lines.push(line);
      line = word;
    } else line = line ? `${line} ${word}` : word;
  }
  if (line) lines.push(line);
  return lines;
}
/** @param {AppContext} ctx */
export function visibleAttributions(ctx) {
  const frame = {
    extent: ctx.view.calculateExtent(ctx.map.getSize()),
    viewState: ctx.view.getState(),
    size: ctx.map.getSize(),
  };
  const values = [];
  for (const layer of ctx.map
    .getAllLayers()
    .filter((layer) => layer.getVisible())) {
    try {
      const attribution = layer.getSource()?.getAttributions()?.(frame);
      for (const value of Array.isArray(attribution)
        ? attribution
        : [attribution])
        if (value) {
          const node = el('div');
          node.innerHTML = value;
          values.push(node.textContent);
        }
    } catch {
      /* The rendered control remains an attribution fallback. */
    }
  }
  for (const entry of ctx.layers.all())
    if (entry.layer?.getVisible() && entry.def.attribution)
      values.push(ctx.localized(entry.def.attribution));
  for (const item of ctx.shell.map.querySelectorAll('.ol-attribution li'))
    values.push(item.textContent);
  return [...new Set(values.filter(Boolean))];
}
/** @param {AppContext} ctx */
export async function waitForMap(ctx, timeout = 20000) {
  await new Promise((resolve, reject) => {
    const key = ctx.map.once('rendercomplete', () => {
      clearTimeout(timer);
      unByKey(key);
      resolve(undefined);
    });
    const timer = setTimeout(() => {
      unByKey(key);
      reject(new Error(ctx.t('print.timeout')));
    }, timeout);
    ctx.map.renderSync();
  });
}
function symbol(context, item, x, y) {
  context.save();
  context.translate(x, y);
  context.fillStyle = item.fill || '#6caaa1';
  context.strokeStyle = item.stroke || '#276d62';
  context.lineWidth = item.strokeWidth || 1.3;
  if (item.dasharray)
    context.setLineDash(
      Array.isArray(item.dasharray)
        ? item.dasharray
        : String(item.dasharray)
            .split(/[ ,]+/)
            .map(Number)
            .filter(Number.isFinite),
    );
  context.globalAlpha = item.fillOpacity ?? 1;
  context.beginPath();
  if (item.type === 'point') {
    if (item.shape === 'square') context.rect(5, 2, 8, 8);
    else if (item.shape === 'diamond' || item.shape === 'triangle') {
      context.moveTo(9, 0);
      context.lineTo(15, 10);
      if (item.shape === 'diamond') context.lineTo(9, 14);
      context.lineTo(3, 10);
      context.closePath();
    } else context.arc(9, 6, 4, 0, Math.PI * 2);
  } else if (item.type === 'line') {
    context.moveTo(0, 10);
    context.lineTo(7, 2);
    context.lineTo(18, 8);
  } else context.rect(0, 0, 18, 11);
  if (item.type !== 'line') context.fill();
  context.globalAlpha = 1;
  context.stroke();
  if (item.hatch && item.type === 'polygon') {
    context.save();
    context.clip();
    context.translate(9, 5.5);
    context.rotate(((Number(item.hatch.angle) || 0) * Math.PI) / 180);
    context.strokeStyle = item.hatch.color || item.stroke || '#276d62';
    context.lineWidth = item.hatch.width || 1;
    context.setLineDash([]);
    const spacing = Math.max(1, Number(item.hatch.spacing) || 6);
    for (let position = -24; position <= 24; position += spacing) {
      context.beginPath();
      context.moveTo(position, -24);
      context.lineTo(position, 24);
      context.stroke();
    }
    context.restore();
  }
  context.restore();
}
/** @param {AppContext} ctx */
export async function composeMap(ctx, title) {
  await waitForMap(ctx);
  const size = ctx.map.getSize();
  const width = size[0] + 40,
    height = size[1],
    ratio = globalThis.devicePixelRatio || 1;
  const canvas = document.createElement('canvas');
  let context = canvas.getContext('2d');
  context.font = '12px Inter';
  const groups = new Map();
  if (ctx.config.print.legend)
    for (const entry of ctx.layers
      .all()
      .filter((entry) => entry.layer?.getVisible())) {
      const section = ctx.config.sidebar.find((section) =>
        section.blocks.some(
          (block) =>
            block.layers?.includes(entry.def.id) ||
            block.layer === entry.def.id,
        ),
      );
      const name = ctx.localized(
        entry.def.catalogTitle ||
          section?.title ||
          ctx.config.branding.title ||
          ctx.config.app.title,
      );
      if (!groups.has(name)) groups.set(name, []);
      groups.get(name).push(entry.def);
    }
  const legend = [];
  let line = 0;
  for (const [name, defs] of groups) {
    let x = 20;
    legend.push({ label: `${name}:`, x, y: line * 22, heading: true });
    x += context.measureText(`${name}:`).width + 14;
    for (const def of defs) {
      const entries = legendEntries(def);
      for (const item of entries) {
        const label =
          entries.length > 1
            ? `${ctx.localized(def.title)} · ${ctx.localized(item.label)}`
            : ctx.localized(def.title);
        const span = context.measureText(label).width + 40;
        if (x + span > width - 20) {
          line++;
          x = 20;
        }
        legend.push({ label, x, y: line * 22, def, item });
        x += span;
      }
    }
    line++;
  }
  context.font = '10px Inter';
  const credits = visibleAttributions(ctx);
  const creditLines = wrapText(context, credits.join(' · '), width - 40);
  const legendHeight = groups.size ? line * 22 + 10 : 0;
  const totalHeight =
    80 + height + 50 + legendHeight + creditLines.length * 14 + 20;
  canvas.width = Math.ceil(width * ratio);
  canvas.height = Math.ceil(totalHeight * ratio);
  context = canvas.getContext('2d');
  context.scale(ratio, ratio);
  context.fillStyle = '#ffffff';
  context.fillRect(0, 0, width, totalHeight);
  let titleX = 20;
  if (ctx.config.print.showLogo && ctx.config.branding.logo) {
    try {
      const image = new Image();
      image.crossOrigin = 'anonymous';
      image.src = safeUrl(ctx.config.branding.logo);
      await image.decode();
      context.drawImage(image, 20, 18, 36, 36);
      titleX = 68;
    } catch {
      /* Optional branding does not prevent export. */
    }
  }
  context.fillStyle = '#18352b';
  context.font = '600 20px Inter';
  context.fillText(
    title || ctx.localized(ctx.config.branding.title || ctx.config.app.title),
    titleX,
    40,
    width - titleX - 120,
  );
  context.font = '11px Inter';
  context.fillStyle = '#54675f';
  context.fillText(new Date().toLocaleDateString(ctx.locale), width - 110, 39);
  context.save();
  context.translate(20, 80);
  context.beginPath();
  context.rect(0, 0, size[0], size[1]);
  context.clip();
  context.fillStyle = '#e9efed';
  context.fillRect(0, 0, size[0], size[1]);
  for (const layerCanvas of ctx.shell.map.querySelectorAll(
    '.ol-layer canvas',
  )) {
    if (!layerCanvas.width) continue;
    context.save();
    const opacity =
      layerCanvas.parentElement.style.opacity || layerCanvas.style.opacity;
    context.globalAlpha = opacity === '' ? 1 : Number(opacity);
    const matrix = layerCanvas.style.transform.match(/^matrix\(([^)]+)\)$/);
    if (matrix) {
      const values = matrix[1].split(',').map(Number);
      context.transform(
        values[0],
        values[1],
        values[2],
        values[3],
        values[4],
        values[5],
      );
    } else {
      const scaleX =
        parseFloat(layerCanvas.style.width) / layerCanvas.width || 1;
      const scaleY =
        parseFloat(layerCanvas.style.height) / layerCanvas.height || 1;
      context.scale(scaleX, scaleY);
    }
    context.drawImage(layerCanvas, 0, 0);
    context.restore();
  }
  context.font = '11px Inter';
  for (const record of ctx.annotations) {
    const coordinate = record.overlay.getPosition();
    if (!coordinate) continue;
    const pixel = ctx.map.getPixelFromCoordinate(coordinate);
    if (!pixel) continue;
    const lines = record.text.split('\n'),
      textWidth = Math.max(
        ...lines.map((line) => context.measureText(line).width),
      );
    const x = Math.max(3, Math.min(size[0] - textWidth - 15, pixel[0] + 8)),
      y = Math.max(16, pixel[1] - lines.length * 15 - 12);
    context.fillStyle = '#fffffff2';
    context.strokeStyle = '#9bb4a8';
    context.fillRect(x - 5, y - 13, textWidth + 10, lines.length * 15 + 10);
    context.strokeRect(x - 5, y - 13, textWidth + 10, lines.length * 15 + 10);
    context.fillStyle = '#173d2d';
    lines.forEach((line, index) => context.fillText(line, x, y + index * 15));
  }
  if (ctx.config.print.northArrow) {
    context.save();
    context.translate(size[0] - 28, 35);
    context.rotate(-ctx.view.getRotation());
    context.fillStyle = '#18352b';
    context.beginPath();
    context.moveTo(0, -18);
    context.lineTo(-7, 10);
    context.lineTo(0, 5);
    context.lineTo(7, 10);
    context.closePath();
    context.fill();
    context.font = '600 12px Inter';
    context.fillText('N', -4, -23);
    context.restore();
  }
  context.restore();
  const footerY = 80 + height + 25;
  const resolution = getPointResolution(
    ctx.view.getProjection(),
    ctx.view.getResolution(),
    ctx.view.getCenter(),
    'm',
  );
  const target = resolution * 100,
    exponent = 10 ** Math.floor(Math.log10(target));
  const distance =
    [5, 2, 1]
      .map((value) => value * exponent)
      .find((value) => value <= target) || exponent / 2;
  const scaleWidth = distance / resolution;
  context.fillStyle = '#18352b';
  context.fillRect(20, footerY, scaleWidth, 4);
  context.fillRect(20, footerY - 4, 1, 9);
  context.fillRect(20 + scaleWidth, footerY - 4, 1, 9);
  context.font = '11px Inter';
  context.fillText(distanceLabel(distance, ctx.locale), 20, footerY + 18);
  const legendY = footerY + 45;
  for (const row of legend) {
    context.font = row.heading ? '600 12px Inter' : '12px Inter';
    context.fillStyle = '#18352b';
    if (row.def) {
      symbol(context, row.item, row.x, legendY + row.y - 9);
      context.fillText(row.label, row.x + 25, legendY + row.y);
    } else context.fillText(row.label, row.x, legendY + row.y);
  }
  context.font = '10px Inter';
  context.fillStyle = '#54675f';
  const creditY = legendY + legendHeight;
  creditLines.forEach((line, index) =>
    context.fillText(line, 20, creditY + index * 14),
  );
  await ctx.hooks.emitAsync('export:compose', {
    sheet: {
      canvas,
      context,
      width,
      height: totalHeight,
      mapRect: [20, 80, size[0], size[1]],
      attributions: credits,
    },
  });
  return new Promise((resolve, reject) => {
    try {
      canvas.toBlob(
        (blob) =>
          blob ? resolve(blob) : reject(new Error(ctx.t('print.cors'))),
        'image/png',
      );
    } catch (error) {
      reject(error);
    }
  });
}
export default {
  id: 'map-export',
  toolIds: ['print'],
  kind: 'tool',
  setup(ctx) {
    const input = el('input', {
      type: 'text',
      'aria-label': ctx.t('print.title'),
      value: ctx.localized(
        ctx.config.print.defaultTitle ||
          ctx.config.branding.title ||
          ctx.config.app.title,
      ),
    });
    const content = el(
      'div',
      {},
      el('label', { class: 'wg-field' }, ctx.t('print.title'), input),
    );
    async function exportMap(printWindow) {
      ctx.ui.toolbar.close();
      try {
        const blob = await composeMap(ctx, input.value);
        if (printWindow) {
          const image = printWindow.document.createElement('img');
          const url = URL.createObjectURL(blob);
          image.src = url;
          image.style.width = '100%';
          image.onload = () => printWindow.print();
          printWindow.document.title = input.value;
          printWindow.document.body.append(image);
          printWindow.onafterprint = () => {
            URL.revokeObjectURL(url);
            printWindow.close();
          };
        } else {
          const now = new Date();
          const date = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
          const time = `${String(now.getHours()).padStart(2, '0')}${String(now.getMinutes()).padStart(2, '0')}`;
          download(
            blob,
            `${ctx.config.print.filenamePrefix}_${date}_${time}.png`,
          );
        }
      } catch (error) {
        printWindow?.close();
        ctx.ui.toast(
          error.name === 'SecurityError' ? ctx.t('print.cors') : error.message,
          'error',
        );
        if (error.name === 'SecurityError')
          ctx.ui.panels.create({
            id: 'export-help',
            title: ctx.t('tool.print'),
            content: el('a', {
              href: safeUrl('docs/recipes/proxy-and-cors.md'),
              text: ctx.t('print.cors'),
              target: '_blank',
              rel: 'noopener noreferrer',
            }),
            persist: false,
          });
      }
    }
    content.append(
      el(
        'div',
        { class: 'wg-actions' },
        el('button', {
          type: 'button',
          text: ctx.t('print.png'),
          class: 'wg-primary',
          onClick: () => void exportMap(null),
        }),
        el('button', {
          type: 'button',
          text: ctx.t('print.print'),
          onClick: () => {
            const printWindow = window.open('', '_blank');
            if (!printWindow) {
              ctx.ui.toast(ctx.t('print.blocked'), 'warning');
              return;
            }
            printWindow.opener = null;
            void exportMap(printWindow);
          },
        }),
      ),
    );
    ctx.ui.toolbar.registerTool({
      id: 'print',
      icon: 'ti-printer',
      exclusive: false,
      popover: content,
    });
  },
};
