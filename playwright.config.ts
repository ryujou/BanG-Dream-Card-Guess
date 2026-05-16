import { defineConfig, devices } from '@playwright/test';

const baseURL = 'http://127.0.0.1:5173';
const noProxy = ['127.0.0.1', 'localhost', process.env.NO_PROXY, process.env.no_proxy].filter(Boolean).join(',');
process.env.NO_PROXY = noProxy;
process.env.no_proxy = noProxy;

export default defineConfig({
  testDir: './tests/e2e',
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: 'html',
  use: {
    baseURL,
    trace: 'on-first-retry',
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
    {
      name: 'Mobile Chrome',
      use: { ...devices['Pixel 5'] },
    },
  ],
  webServer: {
    command: 'npm run dev',
    url: baseURL,
    // Always boot an isolated server for e2e to avoid attaching to stale local dev processes.
    reuseExistingServer: false,
    timeout: 60000,
  },
});
