import { defineConfig } from '@playwright/test';
export default defineConfig({
  testDir: 'tests/browser',
  timeout: 90000,
  expect: { timeout: process.env.BEATSYNC_LIVE_URL ? 20000 : 5000 },
  workers: 1,
  use: {
    baseURL: process.env.BEATSYNC_LIVE_URL || 'http://127.0.0.1:5173',
    headless: true,
    viewport: { width: 1100, height: 720 },
    launchOptions: { channel: 'chrome' },
    trace: 'retain-on-failure',
  },
  reporter: [['list'], ['html', { open: 'never' }]],
  webServer: process.env.BEATSYNC_LIVE_URL
    ? undefined
    : { command: 'npm run dev', url: 'http://127.0.0.1:5173', reuseExistingServer: true },
});
