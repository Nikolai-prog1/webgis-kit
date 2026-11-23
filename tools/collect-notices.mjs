import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, URL as NodeURL } from 'node:url';
const root = fileURLToPath(new NodeURL('../', import.meta.url));
const lock = JSON.parse(
  fs.readFileSync(path.join(root, 'package-lock.json'), 'utf8'),
);
const destination = path.join(root, 'docs/licenses');
fs.mkdirSync(destination, { recursive: true });
const rows = [],
  emails = new Set();
for (const [relative, entry] of Object.entries(lock.packages)) {
  if (!relative || entry.dev) continue;
  const directory = path.join(root, relative);
  if (!fs.existsSync(directory)) continue;
  const metadata = JSON.parse(
    fs.readFileSync(path.join(directory, 'package.json'), 'utf8'),
  );
  const files = fs
    .readdirSync(directory)
    .filter((name) => /^(licen[cs]e|copying|ofl)(\..*)?$/i.test(name));
  let body = files
    .map((name) => fs.readFileSync(path.join(directory, name), 'utf8'))
    .join('\n\n');
  if (!body && metadata.name === 'lerc') {
    const source = fs.readFileSync(
      path.join(directory, 'LercDecode.js'),
      'utf8',
    );
    const header = [...source.matchAll(/\/\*[\s\S]*?\*\//g)]
      .map((match) => match[0])
      .find(
        (text) => text.includes('Copyright') && text.includes('Licensed under'),
      );
    body =
      header +
      '\n\n' +
      fs.readFileSync(
        path.join(root, 'node_modules/web-worker/LICENSE'),
        'utf8',
      );
  }
  if (!body) throw new Error(`No license text found for ${metadata.name}.`);
  const file = `${metadata.name.replaceAll('@', '').replaceAll('/', '-')}-${metadata.version}.txt`;
  const text = `Package: ${metadata.name}\nVersion: ${metadata.version}\nSource: https://www.npmjs.com/package/${metadata.name}\n\n${body.replaceAll('\r\n', '\n').trim()}\n`;
  fs.writeFileSync(path.join(destination, file), text);
  for (const email of text.match(
    /[A-Z\d.!#$%&'*+/=?^_`{|}~-]+@[A-Z\d.-]+\.[A-Z]{2,}/gi,
  ) || [])
    emails.add(email);
  rows.push(
    `| ${metadata.name} | ${metadata.version} | ${metadata.license || (/MIT License/.test(body) ? 'MIT' : 'see text')} | [notice](docs/licenses/${file}) |`,
  );
}
const notice = `# Third-party notices\n\nWebGIS Kit is MIT licensed. OpenLayers, proj4, Inter and Tabler assets are installed from npm and bundled locally. The following notice files preserve the production dependency tree's copyright and license texts; not every optional format decoder is included in the application bundle. Distribution builds include these notices under \`licenses/\`.\n\n## Dependencies\n\n| Package | Version | License | Text |\n| --- | --- | --- | --- |\n${rows.sort().join('\n')}\n\n## Data and maps\n\nThe committed cities, rivers and simplified countries come from Natural Earth 1:110m, release v5.1.2, in the public domain. Source fields were reduced and country geometry simplified. See [Natural Earth terms](https://www.naturalearthdata.com/about/terms-of-use/) and the dataset metadata. Synthetic fallback generation is available explicitly in the demo-data tool.\n\nOpenStreetMap data is ODbL; its public tile service has a separate [usage policy](https://operations.osmfoundation.org/policies/tiles/). Preserve the visible credit supplied by the OpenLayers OSM source.\n\nThe optional 2016 EOX basemap is CC BY 4.0. Its complete credit is in the demo configuration and is included in map exports. The provider's [FAQ](https://cloudless.eox.at/documentation/faq) describes permitted use and service limits. The optional public WMS is subject to [terrestris terms](https://terrestris.de/produkte/freier-osm-wms/). Neither service is required to load the demo.\n\nThe kit's small SVG brand and synthetic fixtures were created for this template; they contain no external imagery.\n`;
fs.writeFileSync(path.join(root, 'NOTICE.md'), notice);
console.log(
  JSON.stringify(
    { notices: rows.length, publicLicenseContacts: [...emails].sort() },
    null,
    2,
  ),
);
