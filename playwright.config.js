import { defineConfig, devices } from '@playwright/test';
import path from 'node:path';
const live = process.env.WEBGIS_LIVE_GEOSERVER === '1';
const imported = live && process.env.WEBGIS_LIVE_INSTANCE;
export default defineConfig({
  testDir: 'tests/e2e',
  fullyParallel: false,
  workers: 1,
  // Pointer-timing scenarios can flake on busy hosted runners; one retry in CI.
  retries: process.env.CI ? 1 : 0,
  timeout: 30000,
  use: { baseURL: 'http://127.0.0.1:4173', trace: 'retain-on-failure' },
  webServer: [
    {
      command: 'node tools/test-server.mjs',
      url: 'http://127.0.0.1:4173',
      reuseExistingServer: !process.env.CI,
    },
    ...(live
      ? [
          {
            command: 'npm run dev -- --port 4273 --strictPort',
            url: 'http://127.0.0.1:4273',
            reuseExistingServer: false,
            env: {
              WEBGIS_APP_DIR: path.resolve('examples/configs/geoserver-full'),
              GEOSERVER_URL:
                process.env.GEOSERVER_URL || 'http://127.0.0.1:8080',
            },
          },
        ]
      : []),
    ...(imported
      ? [
          {
            command: 'npm run dev -- --port 4373 --strictPort',
            url: 'http://127.0.0.1:4373',
            reuseExistingServer: false,
            env: { WEBGIS_APP_DIR: path.resolve(imported) },
          },
        ]
      : []),
  ],
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
      testIgnore: /screenshots/,
    },
    {
      name: 'screenshots',
      use: { ...devices['Desktop Chrome'], deviceScaleFactor: 2 },
      testMatch: /screenshots/,
    },
    ...(live
      ? [
          {
            name: 'live',
            testDir: 'tests/e2e-live',
            testIgnore: /imported/,
            timeout: 60000,
            use: {
              ...devices['Desktop Chrome'],
              baseURL: 'http://127.0.0.1:4273',
              trace: 'off',
            },
          },
        ]
      : []),
    ...(imported
      ? [
          {
            name: 'imported',
            testDir: 'tests/e2e-live',
            testMatch: /imported/,
            timeout: 60000,
            use: {
              ...devices['Desktop Chrome'],
              baseURL: 'http://127.0.0.1:4373',
              trace: 'off',
            },
          },
        ]
      : []),
  ],
});
