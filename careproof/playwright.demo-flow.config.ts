import { defineConfig, devices } from '@playwright/test';

const externalBaseUrl = process.env.PLAYWRIGHT_WEB_BASE_URL;

export default defineConfig({
  testDir: './tests/e2e',
  testMatch: 'careproof-demo-flow.spec.ts',
  timeout: 60_000,
  expect: {
    timeout: 10_000,
  },
  fullyParallel: false,
  retries: 1,
  reporter: 'list',
  use: {
    baseURL: externalBaseUrl ?? 'http://127.0.0.1:3004',
    trace: process.env.CI ? 'retain-on-failure' : 'on-first-retry',
  },
  webServer: externalBaseUrl
    ? undefined
    : {
        command:
          "sh -c 'cd apps/web && pnpm exec next build >/dev/null && pnpm exec next start --hostname 127.0.0.1 --port 3004'",
        url: 'http://127.0.0.1:3004',
        reuseExistingServer: true,
        timeout: 180_000,
      },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
});
