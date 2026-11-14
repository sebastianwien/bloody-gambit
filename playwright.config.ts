import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: 'tests/e2e',
  timeout: 180_000,
  retries: 0,
  workers: 1,
  use: {
    baseURL: 'http://localhost:5180',
    viewport: { width: 1920, height: 1080 },
    headless: true,
  },
  webServer: [
    { command: 'npm run dev', port: 5180, reuseExistingServer: true, timeout: 60_000 },
    { command: 'npm run server', port: 8790, reuseExistingServer: true, timeout: 30_000 },
  ],
});
