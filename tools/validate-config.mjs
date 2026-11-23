import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, URL as NodeURL } from 'node:url';
import Ajv from 'ajv';
import { normalize } from '../src/core/config/normalize.js';
import { validateLite } from '../src/core/config/validateLite.js';
const root = fileURLToPath(new NodeURL('../', import.meta.url));
const ajv = new Ajv({ allErrors: true, strict: false });
const appSchema = JSON.parse(
  fs.readFileSync(
    path.join(root, 'src/core/config/schema/app.schema.json'),
    'utf8',
  ),
);
const catalogSchema = JSON.parse(
  fs.readFileSync(
    path.join(root, 'src/core/config/schema/catalog.schema.json'),
    'utf8',
  ),
);
const validators = {
  app: ajv.compile(appSchema),
  catalog: ajv.compile(catalogSchema),
  layer: ajv.compile(appSchema.$defs.layer),
  block: ajv.compile(
    appSchema.properties.sidebar.items.properties.blocks.items,
  ),
};
export function validateObject(value, kind = 'app') {
  const validator = validators[kind];
  return validator(value)
    ? []
    : validator.errors.map(
        (e) =>
          `${e.instancePath || '/'}: ${e.message} (${JSON.stringify(e.params)})`,
      );
}
export function validateAppDir(appDir) {
  const errors = [];
  function read(file, kind) {
    try {
      const data = JSON.parse(fs.readFileSync(file, 'utf8'));
      errors.push(...validateObject(data, kind).map((e) => `${file} â†’ ${e}`));
      return data;
    } catch (error) {
      errors.push(`${file} â†’ ${error.message}`);
      return null;
    }
  }
  const file = path.join(appDir, 'static/config/app.json');
  const app = read(file, 'app');
  if (!app) return errors;
  const catalogs = {};
  for (const cat of app.catalogs || [])
    if (cat.src) {
      const data = read(path.resolve(appDir, 'static', cat.src), 'catalog');
      if (data) catalogs[cat.id] = data;
    }
  if (!errors.length) {
    try {
      errors.push(
        ...validateLite(normalize(app, catalogs)).map(
          (e) => `${file} â†’ ${e}`,
        ),
      );
    } catch (error) {
      errors.push(`${file} â†’ ${error.message}`);
    }
  }
  return errors;
}
export function validateAll(
  appDir = process.env.WEBGIS_APP_DIR || path.join(root, 'app'),
  includeExamples = false,
) {
  const errors = validateAppDir(path.resolve(appDir));
  const examples = path.join(root, 'examples/configs');
  if (includeExamples && fs.existsSync(examples))
    for (const entry of fs.readdirSync(examples))
      if (fs.existsSync(path.join(examples, entry, 'static/config/app.json')))
        errors.push(...validateAppDir(path.join(examples, entry)));
  if (includeExamples) {
    errors.push(...validateAppDir(path.join(root, 'templates/starter-app')));
    function markdown(dir) {
      if (!fs.existsSync(dir)) return;
      for (const item of fs.readdirSync(dir, { withFileTypes: true })) {
        const file = path.join(dir, item.name);
        if (item.isDirectory()) markdown(file);
        else if (item.name.endsWith('.md')) {
          const text = fs.readFileSync(file, 'utf8');
          for (const block of text.matchAll(/```json\s*\n([\s\S]*?)\n```/g)) {
            try {
              const value = JSON.parse(block[1]);
              const kind =
                value.version !== undefined
                  ? 'app'
                  : value.groups
                    ? 'catalog'
                    : value.source
                      ? 'layer'
                      : 'block';
              errors.push(
                ...validateObject(value, kind).map(
                  (e) => `${file} â†’ JSON example â†’ ${e}`,
                ),
              );
              if (kind === 'app' && !validateObject(value, 'app').length)
                errors.push(
                  ...validateLite(normalize(value)).map(
                    (e) => `${file} â†’ JSON example â†’ ${e}`,
                  ),
                );
            } catch (error) {
              errors.push(`${file} â†’ JSON example â†’ ${error.message}`);
            }
          }
        }
      }
    }
    markdown(path.join(root, 'docs'));
    markdown(path.join(root, 'skills/webgis/references'));
    for (const name of ['README.md', 'README.bg.md']) {
      const file = path.join(root, name);
      if (fs.existsSync(file)) {
        const text = fs.readFileSync(file, 'utf8');
        for (const block of text.matchAll(/```json\s*\n([\s\S]*?)\n```/g)) {
          try {
            const value = JSON.parse(block[1]);
            errors.push(
              ...validateObject(value, 'app').map((e) => `${name} â†’ ${e}`),
            );
          } catch (error) {
            errors.push(`${name} â†’ ${error.message}`);
          }
        }
      }
    }
  }
  return errors;
}
if (
  process.argv[1] &&
  path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)
) {
  const errors = validateAll(process.argv[2], !process.argv[2]);
  if (errors.length) {
    console.error(errors.join('\n'));
    process.exitCode = 1;
  } else console.log('Configuration schemas and cross references passed.');
}
