import fs from 'node:fs';
import { test, expect } from 'vitest';

const compose = fs.readFileSync('stack/docker-compose.yml', 'utf8');
const init = fs.readFileSync('stack/initdb/20-webgis.sh', 'utf8');

test('Docker stack passes the application password through the environment, not a mounted file', () => {
  expect(compose).toContain('WEBGIS_DB_PASSWORD: ${WEBGIS_DB_PASSWORD:?');
  expect(compose).toContain(
    './initdb/20-webgis.sh:/docker-entrypoint-initdb.d/20-webgis.sh:ro',
  );
  expect(compose).not.toMatch(/WEBGIS_STACK_HOME\}\/[^:]+\.sql/);
  expect(init).toContain("format('CREATE ROLE webgis LOGIN PASSWORD %L'");
  expect(init).toContain('\\gexec');
  expect(init).toContain('-v app_password="$WEBGIS_DB_PASSWORD"');
  // Sourced by the entrypoint when not executable: must not change -u.
  expect(init).not.toMatch(/^set -[a-z]*u/m);
});
