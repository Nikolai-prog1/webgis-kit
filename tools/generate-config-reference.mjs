import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, URL as NodeURL } from 'node:url';
const root = fileURLToPath(new NodeURL('../', import.meta.url));
function type(schema) {
  if (schema.enum) return schema.enum.map((value) => `\`${value}\``).join(', ');
  if (schema.const !== undefined) return `\`${schema.const}\``;
  if (schema.$ref) return schema.$ref.split('/').at(-1);
  if (schema.oneOf) return schema.oneOf.map(type).join(' or ');
  return Array.isArray(schema.type)
    ? schema.type.join(' or ')
    : schema.type || 'any';
}
export function generateReference() {
  let output =
    '# Configuration reference\n\nGenerated from the shipped JSON Schemas. Run `npm run reference` after changing a schema. URL paths resolve against the page directory; all map extents use longitude/latitude unless explicitly marked otherwise. Editor `$schema` paths are ignored at runtime.\n\n';
  for (const [name, file] of [
    ['Application', 'app'],
    ['Catalog', 'catalog'],
  ]) {
    const schema = JSON.parse(
      fs.readFileSync(
        path.join(root, `src/core/config/schema/${file}.schema.json`),
        'utf8',
      ),
    );
    output += `## ${name}\n\n| Field | Type | Required |\n| --- | --- | --- |\n`;
    function walk(node, prefix = '', required = false, seen = new Set()) {
      if (node.$ref) {
        const key = node.$ref.split('/').at(-1);
        if (seen.has(key)) return;
        node = schema.$defs[key];
        seen = new Set([...seen, key]);
      }
      if (prefix)
        output += `| \`${prefix}\` | ${type(node).replaceAll('|', '\\|')} | ${required ? 'yes' : 'no'} |\n`;
      if (node.properties)
        for (const [key, value] of Object.entries(node.properties))
          walk(
            value,
            prefix ? `${prefix}.${key}` : key,
            node.required?.includes(key),
            seen,
          );
      if (node.items) walk(node.items, `${prefix}[]`, false, seen);
      if (
        node.additionalProperties &&
        typeof node.additionalProperties === 'object'
      )
        walk(node.additionalProperties, `${prefix}.*`, false, seen);
    }
    walk(schema);
    output += '\n';
  }
  return output;
}
if (
  process.argv[1] &&
  path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)
) {
  const destination = path.join(
    root,
    'skills/webgis/references/config-reference.md',
  );
  const reference = generateReference();
  if (process.argv.includes('--check')) {
    if (
      !fs.existsSync(destination) ||
      fs.readFileSync(destination, 'utf8') !== reference
    ) {
      console.error('Config reference is stale. Run npm run reference.');
      process.exitCode = 1;
    } else console.log('Generated configuration reference is current.');
  } else {
    fs.mkdirSync(path.dirname(destination), { recursive: true });
    fs.writeFileSync(destination, reference);
    console.log('Generated configuration reference.');
  }
}
