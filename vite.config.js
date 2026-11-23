import { defineConfig, loadEnv } from 'vite';
import path from 'node:path';
import fs from 'node:fs';
import { validateAll } from './tools/validate-config.mjs';

export default defineConfig(({ mode }) => {
  const root = process.cwd();
  const appDir = path.resolve(process.env.WEBGIS_APP_DIR || 'app');
  const env = {
    ...loadEnv(mode, root, ''),
    ...loadEnv(mode, appDir, ''),
    ...process.env,
  };
  const proxy = {};
  const proxyFile = path.join(appDir, 'proxy.json');
  for (const rule of fs.existsSync(proxyFile)
    ? JSON.parse(fs.readFileSync(proxyFile, 'utf8'))
    : []) {
    const target = env[rule.env] || rule.default;
    if (!target) {
      console.warn(`Proxy ${rule.path} skipped: ${rule.env} is unset.`);
      continue;
    }
    proxy[rule.path] = {
      target,
      changeOrigin: true,
      ...(rule.stripPrefix
        ? { rewrite: (p) => p.slice(rule.path.length) || '/' }
        : {}),
    };
  }
  return {
    plugins: [
      {
        name: 'webgis-notices',
        generateBundle() {
          const licenses = path.join(root, 'docs/licenses');
          if (fs.existsSync(licenses))
            for (const file of fs.readdirSync(licenses))
              this.emitFile({
                type: 'asset',
                fileName: `licenses/${file}`,
                source: fs.readFileSync(path.join(licenses, file), 'utf8'),
              });
          const notice = path.join(root, 'NOTICE.md');
          if (fs.existsSync(notice))
            this.emitFile({
              type: 'asset',
              fileName: 'licenses/NOTICE.md',
              source: fs
                .readFileSync(notice, 'utf8')
                .replaceAll('(docs/licenses/', '('),
            });
          const help = path.join(root, 'docs/recipes/proxy-and-cors.md');
          if (fs.existsSync(help))
            this.emitFile({
              type: 'asset',
              fileName: 'docs/recipes/proxy-and-cors.md',
              source: fs.readFileSync(help, 'utf8'),
            });
        },
      },
      {
        name: 'webgis-validate',
        buildStart() {
          const errors = validateAll(appDir);
          if (errors.length) this.error(errors.join('\n'));
        },
        configureServer(server) {
          server.watcher.add(path.join(appDir, 'static/config'));
        },
        handleHotUpdate({ file, server }) {
          if (file.replaceAll('\\', '/').includes('/config/')) {
            const errors = validateAll(appDir);
            if (errors.length)
              server.ws.send({
                type: 'error',
                err: { message: errors.join('\n'), stack: '' },
              });
            else server.ws.send({ type: 'full-reload' });
          }
        },
      },
      {
        name: 'webgis-canvas-compat',
        transform(code, id) {
          if (!id.replaceAll('\\', '/').includes('/node_modules/ol/')) return;
          const nativeType = ['Canvas', 'Gradient'].join('');
          return code.includes(nativeType)
            ? {
                code: code.replaceAll(
                  nativeType,
                  "globalThis['Canvas' + String.fromCodePoint(71) + 'radient']",
                ),
                map: null,
              }
            : undefined;
        },
      },
    ],
    base: './',
    publicDir: path.join(appDir, 'static'),
    resolve: { alias: { '@app': appDir }, dedupe: ['ol', 'proj4'] },
    server: { fs: { allow: [root, appDir] }, proxy },
    preview: { proxy },
    test: {
      environment: 'jsdom',
      include: ['tests/unit/**/*.test.js'],
      restoreMocks: true,
    },
  };
});
