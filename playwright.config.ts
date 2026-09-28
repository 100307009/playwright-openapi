import { defineConfig } from '@playwright/test';
import { getUiBaseUrl } from './src/config/env';

/**
 * One Playwright project per test type (contract/flow/UI), all sharing the same fixture layer
 * (see src/fixtures/index.ts) - a credential or endpoint change in .env propagates to all three
 * automatically.
 */
export default defineConfig({
  testDir: './tests',
  globalSetup: require.resolve('./tests/global-setup.ts'),
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  // Every test here talks to a real, third-party-hosted demo (not a mock) - one retry
  // absorbs the demo's occasional network/render hiccups without hiding a real failure
  // (the second attempt's own trace/attachments still show up in the Allure report).
  retries: process.env.CI ? 2 : 1,
  reporter: [
    ['list'],
    ['allure-playwright', { resultsDir: 'allure-results', detail: true, suiteTitle: true }],
  ],
  use: {
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
  },
  projects: [
    {
      name: 'contract',
      testDir: './tests/contract',
    },
    {
      name: 'flow',
      testDir: './tests/flow',
    },
    {
      name: 'ui',
      testDir: './tests/ui',
      use: {
        baseURL: getUiBaseUrl(),
        browserName: 'chromium',
      },
    },
  ],
});
