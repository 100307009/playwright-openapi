import { test, expect } from '../../src/fixtures';
import { buildPath } from '../../src/utils/buildPath';
import { buildTemplateContext, resolveRecord, resolveQueryParams, resolveBody } from '../../src/testData/templateContext';
import { storeGetScenarios, storePostScenarios } from '../../src/testData/store.testData';
import { login } from '../../src/steps/auth.steps';

/**
 * See tests/contract/pet.contract.spec.ts for what a contract test checks and how the
 * scenario-loop pattern works. Scenarios live in src/testData/store.testData.ts.
 */
test.describe('Contract: /store', () => {
  test.describe('GET', () => {
    for (const scenario of storeGetScenarios) {
      test(scenario.name, async ({ apiClient, validateSchema, apiConfig, credentials }) => {
        const ctx = buildTemplateContext(apiConfig);

        if (scenario.requiresAuth) {
          await login(apiClient, credentials.valid);
        }

        const setupResult = scenario.setup ? await scenario.setup({ apiClient }) : undefined;
        try {
          const pathParams = { ...resolveRecord(scenario.pathParams, ctx), ...setupResult?.pathParams };
          const path = buildPath(scenario.path, pathParams);

          const response = await apiClient.get(path, {
            params: resolveQueryParams(scenario.queryParams, ctx),
            headers: resolveRecord(scenario.headers, ctx),
          });
          expect(response.status).toBe(scenario.expectedStatus);

          if (scenario.expectValidSchema !== undefined) {
            const result = await validateSchema({ method: 'GET', path: scenario.path, status: response.status }, response.body);
            expect(result.valid).toBe(scenario.expectValidSchema);
          }
        } finally {
          await setupResult?.teardown?.();
        }
      });
    }
  });

  test.describe('POST', () => {
    for (const scenario of storePostScenarios) {
      test(scenario.name, async ({ apiClient, validateSchema, apiConfig, credentials }) => {
        const ctx = buildTemplateContext(apiConfig);

        if (scenario.requiresAuth) {
          await login(apiClient, credentials.valid);
        }

        const setupResult = scenario.setup ? await scenario.setup({ apiClient }) : undefined;
        try {
          const pathParams = { ...resolveRecord(scenario.pathParams, ctx), ...setupResult?.pathParams };
          const path = buildPath(scenario.path, pathParams);
          const body = setupResult?.body ?? resolveBody(scenario.body);

          const response = await apiClient.post(path, {
            params: resolveQueryParams(scenario.queryParams, ctx),
            headers: resolveRecord(scenario.headers, ctx),
            data: body,
          });
          expect(response.status).toBe(scenario.expectedStatus);

          if (scenario.expectValidSchema !== undefined) {
            const result = await validateSchema({ method: 'POST', path: scenario.path, status: response.status }, response.body);
            expect(result.valid).toBe(scenario.expectValidSchema);
          }
        } finally {
          await setupResult?.teardown?.();
        }
      });
    }
  });
});
