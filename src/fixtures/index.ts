import { test as base } from '@playwright/test';
import * as allure from 'allure-js-commons';
import { ContentType } from 'allure-js-commons';
import { ApiVersion, VersionConfig, requireVersionConfig } from '../config/env';
import { ApiClient } from './apiClient';
import { OperationSelector, SchemaValidationResult, validateResponse } from '../spec/schemaValidator';

export interface TestOptions {
  /** Which API version this test/project targets. Set per Playwright project via `use: { apiVersion }`. */
  apiVersion: ApiVersion;
}

export interface TestFixtures {
  versionConfig: VersionConfig;
  apiClient: ApiClient;
  /** Valid/invalid credentials for the active version - shared identically across contract, flow and UI tests. */
  credentials: VersionConfig['credentials'];
  /** Known-good/known-bad IDs for the active version, for negative testing. */
  fixtureIds: VersionConfig['fixtures'];
  /**
   * Validates a response body against the schema the OpenAPI spec documents
   * for `method + path + status`, and records the result to the Allure report.
   * `path` must be the templated spec path (e.g. "/pet/{petId}"), not the
   * concrete request URL.
   */
  validateSchema: (selector: OperationSelector, body: unknown) => Promise<SchemaValidationResult>;
}

export const test = base.extend<TestFixtures & TestOptions>({
  apiVersion: ['v2', { option: true }],

  versionConfig: async ({ apiVersion }, use) => {
    await use(requireVersionConfig(apiVersion));
  },

  apiClient: async ({ versionConfig }, use) => {
    await use(new ApiClient(versionConfig.baseUrl));
  },

  credentials: async ({ versionConfig }, use) => {
    await use(versionConfig.credentials);
  },

  fixtureIds: async ({ versionConfig }, use) => {
    await use(versionConfig.fixtures);
  },

  validateSchema: async ({ apiVersion }, use) => {
    await use(async (selector: OperationSelector, body: unknown) => {
      const result = validateResponse(apiVersion, selector, body);
      await allure.step(`Validate schema: ${selector.method} ${selector.path} -> ${selector.status}`, async () => {
        await allure.attachment('Schema validation result', JSON.stringify(result, null, 2), ContentType.JSON);
      });
      return result;
    });
  },
});

export { expect } from '@playwright/test';
