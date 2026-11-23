import { expect, test } from 'vitest';
test('ES modules are available', () =>
  expect(
    new URL('../../src/main.js', import.meta.url).pathname.endsWith(
      '/src/main.js',
    ),
  ).toBe(true));
