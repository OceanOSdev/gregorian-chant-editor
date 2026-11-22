import { fileURLToPath } from 'node:url';
import { defineConfig, devices } from '@playwright/test';
import {
  devOrigin,
  devPort,
  previewOrigin,
  previewPort,
} from './tests/e2e/helpers/origins.ts';

const root = fileURLToPath(new URL('.', import.meta.url));
// Reuses the verification runner's launcher: the repository's own
// vite.config.ts on 127.0.0.1 with a strict port, plus a private dependency
// cache (dev) or output directory (preview) so these servers never share
// state with an owner's `npm run dev` or `dist/`.
const viteServer = 'node docs/verification/runner/vite-server.mjs --root .';
const previewOut = '.playwright/preview-dist';

export default defineConfig({
  testDir: './tests/e2e',
  outputDir: '.playwright/test-results',
  fullyParallel: true,
  forbidOnly: true,
  retries: 0,
  timeout: 30_000,
  expect: { timeout: 5_000 },
  reporter: [
    ['list'],
    ['html', { outputFolder: '.playwright/report', open: 'never' }],
  ],
  use: {
    viewport: { width: 1440, height: 1100 },
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  projects: [
    {
      name: 'chromium',
      use: {
        ...devices['Desktop Chrome'],
        viewport: { width: 1440, height: 1100 },
      },
    },
    {
      name: 'firefox',
      use: {
        ...devices['Desktop Firefox'],
        viewport: { width: 1440, height: 1100 },
      },
    },
  ],
  // Both servers start for every invocation. Specs choose their origin with
  // `test.use({ baseURL })`. reuseExistingServer is false so an unrelated
  // application already listening on either port fails the run instead of
  // being tested.
  webServer: [
    {
      name: 'dev fixture',
      command: `${viteServer} --mode dev --cache-dir .playwright/vite-cache --port ${devPort}`,
      cwd: root,
      url: `${devOrigin}/docs/verification/placement/browser-fixture.html`,
      reuseExistingServer: false,
      timeout: 60_000,
      gracefulShutdown: { signal: 'SIGTERM', timeout: 5_000 },
    },
    {
      name: 'production preview',
      command: `${viteServer} --mode build --out-dir ${previewOut} && ${viteServer} --mode preview --out-dir ${previewOut} --port ${previewPort}`,
      cwd: root,
      url: `${previewOrigin}/`,
      reuseExistingServer: false,
      timeout: 120_000,
      gracefulShutdown: { signal: 'SIGTERM', timeout: 5_000 },
    },
  ],
});
