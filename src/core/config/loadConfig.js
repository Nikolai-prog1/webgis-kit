import { normalize } from './normalize.js';
import { validateLite } from './validateLite.js';
export async function loadConfig(base = document.baseURI) {
  async function read(name) {
    const response = await fetch(new URL(name, base), {
      signal: AbortSignal.timeout(30000),
    });
    if (!response.ok) throw new Error(`${name}: HTTP ${response.status}`);
    try {
      return await response.json();
    } catch {
      throw new Error(`${name}: expected valid JSON`);
    }
  }
  const input = await read('config/app.json');
  const entries = await Promise.all(
    (input.catalogs || [])
      .filter((cat) => cat.src)
      .map(async (cat) => [cat.id, await read(cat.src)]),
  );
  const config = normalize(input, Object.fromEntries(entries));
  const errors = validateLite(config);
  if (errors.length) throw new Error(`config/app.json\n${errors.join('\n')}`);
  return config;
}
