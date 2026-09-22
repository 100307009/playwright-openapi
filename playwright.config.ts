import { defineConfig } from '@playwright/test';
import { getUiBaseUrl } from './src/config/env';
import type { TestOptions } from './src/fixtures';

/**
 * Every API version gets its own project per test type, all pointed at the
 * same test files. Version-specific behaviour (base URL, spec, credentials,
 * fixture IDs) flows in entirely through the `apiVersion` fixture option
 * (see src/fixtures/index.ts) - test code never branches on version itself.
 *
 * To add a new version once its spec/backend exists:
 *   1. Fill in API_<VERSION>_* in .env (see .env.example)
 *   2. Copy the *-v2 project blocks below, swap `apiVersion: 'v2'` -> the new version
 * No test file needs to change.
 */
export default defineConfig<TestOptions>({
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
      name: 'contract-v2',
      testDir: './tests/contract',
      use: { apiVersion: 'v2' },
    },
    {
      name: 'flow-v2',
      testDir: './tests/flow',
      use: { apiVersion: 'v2' },
    },
    {
      name: 'ui-v2',
      testDir: './tests/ui',
      use: {
        apiVersion: 'v2',
        baseURL: getUiBaseUrl('v2'),
        browserName: 'chromium',
      },
    },

    // --- v1 (not wired up yet) -------------------------------------------
    // Once API_V1_SPEC_URL / API_V1_BASE_URL are set in .env, uncomment:
    // {
    //   name: 'contract-v1',
    //   testDir: './tests/contract',
    //   use: { apiVersion: 'v1' },
    // },
    // {
    //   name: 'flow-v1',
    //   testDir: './tests/flow',
    //   use: { apiVersion: 'v1' },
    // },
  ],
});
