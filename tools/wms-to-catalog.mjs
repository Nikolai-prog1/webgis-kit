import fs from 'node:fs';
import { DOMParser } from '@xmldom/xmldom';
import {
  parseCapabilities,
  capabilitiesToCatalog,
} from '../src/core/data/wmsCapabilities.js';
const args = process.argv.slice(2);
const url = args[0];
if (!url || url.startsWith('--')) {
  console.error(
    'Usage: node tools/wms-to-catalog.mjs <url> [--out file] [--service id] [--id id]',
  );
  process.exitCode = 1;
} else {
  try {
    const target = new URL(url);
    target.searchParams.set('SERVICE', 'WMS');
    target.searchParams.set('REQUEST', 'GetCapabilities');
    const response = await fetch(target, {
      signal: AbortSignal.timeout(30000),
    });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const tree = parseCapabilities(await response.text(), new DOMParser());
    const option = (flag, fallback) =>
      args.includes(flag) ? args[args.indexOf(flag) + 1] : fallback;
    const catalog = capabilitiesToCatalog(tree, {
      id: option('--id', 'external'),
      service: option('--service', 'external'),
    });
    const result = JSON.stringify(catalog, null, 2) + '\n';
    const out = option('--out', null);
    if (out) fs.writeFileSync(out, result);
    else process.stdout.write(result);
  } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
  }
}
