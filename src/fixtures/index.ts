import { test as base } from '@playwright/test';
import * as allure from 'allure-js-commons';
import { ContentType } from 'allure-js-commons';
import { ApiConfig, requireApiConfig } from '../config/env';
import { ApiClient } from './apiClient';
import { OperationSelector, SchemaValidationResult, validateResponse } from '../spec/schemaValidator';

export interface TestFixtures {
  apiConfig: ApiConfig;
  apiClient: ApiClient;
  /** Valid/invalid credentials - shared identically across contract, flow and UI tests. */
  credentials: ApiConfig['credentials'];
  /** Known-good/known-bad IDs, for negative testing. */
  fixtureIds: ApiConfig['fixtures'];
  /**
   * Validates a response body against the schema the OpenAPI spec documents
   * for `method + path + status`, and records the result to the Allure report.
   * `path` must be the templated spec path (e.g. "/pet/{petId}"), not the
   * concrete request URL.
   */
  validateSchema: (selector: OperationSelector, body: unknown) => Promise<SchemaValidationResult>;
}

export const test = base.extend<TestFixtures>({
  apiConfig: async ({}, use) => {
    await use(requireApiConfig());
  },

  apiClient: async ({ apiConfig }, use) => {
    await use(new ApiClient(apiConfig.baseUrl));
  },

  credentials: async ({ apiConfig }, use) => {
    await use(apiConfig.credentials);
  },

  fixtureIds: async ({ apiConfig }, use) => {
    await use(apiConfig.fixtures);
  },

  validateSchema: async ({}, use) => {
    await use(async (selector: OperationSelector, body: unknown) => {
      const result = validateResponse(selector, body);
      await allure.step(`Validate schema: ${selector.method} ${selector.path} -> ${selector.status}`, async () => {
        await allure.attachment('Schema validation result', JSON.stringify(result, null, 2), ContentType.JSON);
      });
      return result;
    });
  },
});

export { expect } from '@playwright/test';
