import fs from 'node:fs';
import path from 'node:path';
import { test, expect } from 'vitest';
import en from '../../src/core/i18n/locales/en.json';
import bg from '../../src/core/i18n/locales/bg.json';
test('every literal core translation key is available in both languages', () => {
  const keys = new Set();
  function walk(dir) {
    for (const item of fs.readdirSync(dir, { withFileTypes: true })) {
      const file = path.join(dir, item.name);
      if (item.isDirectory()) walk(file);
      else if (item.name.endsWith('.js'))
        for (const match of fs
          .readFileSync(file, 'utf8')
          .matchAll(/\bt\(['"]([^'"]+)['"]/g))
          keys.add(match[1]);
    }
  }
  walk('src/core');
  for (const key of keys)
    for (const dictionary of [en, bg])
      expect(
        key in dictionary ||
          (`${key}_one` in dictionary && `${key}_other` in dictionary),
        key,
      ).toBe(true);
  for (const id of [
    'measure-distance',
    'measure-area',
    'marker',
    'goto-coordinates',
    'home',
    'print',
    'clear',
  ])
    expect(`tool.${id}` in en).toBe(true);
});
