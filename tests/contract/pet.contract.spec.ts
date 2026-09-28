import { test, expect } from '../../src/fixtures';
import { buildPath } from '../../src/utils/buildPath';
import { buildTemplateContext, resolveRecord, resolveQueryParams, resolveBody } from '../../src/testData/templateContext';
import { petGetScenarios, petPostScenarios, petPutScenarios, petDeleteScenarios } from '../../src/testData/pet.testData';
import { login } from '../../src/steps/auth.steps';

/**
 * Contract tests check ONE thing: does what the live server actually sends
 * back match what the OpenAPI spec documents for that status code? They are
 * intentionally decoupled from business-logic correctness (see tests/flow)
 * so a spec/implementation drift shows up here first, cheaply, without a
 * multi-step scenario failing further down the suite.
 *
 * Each `describe` below is one for-loop over that request type's scenarios
 * (src/testData/pet.testData.ts) - adding coverage is adding a scenario
 * there, not a new test. `if (scenario.requiresAuth)`/`scenario.setup` are
 * the "intermediate step" hooks a scenario can opt into; see
 * src/testData/types.ts for what each scenario field means.
 */
test.describe('Contract: /pet', () => {
  test.describe('GET', () => {
    for (const scenario of petGetScenarios) {
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
    for (const scenario of petPostScenarios) {
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

  test.describe('PUT', () => {
    for (const scenario of petPutScenarios) {
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

          const response = await apiClient.put(path, {
            params: resolveQueryParams(scenario.queryParams, ctx),
            headers: resolveRecord(scenario.headers, ctx),
            data: body,
          });
          expect(response.status).toBe(scenario.expectedStatus);

          if (scenario.expectValidSchema !== undefined) {
            const result = await validateSchema({ method: 'PUT', path: scenario.path, status: response.status }, response.body);
            expect(result.valid).toBe(scenario.expectValidSchema);
          }
        } finally {
          await setupResult?.teardown?.();
        }
      });
    }
  });

  test.describe('DELETE', () => {
    for (const scenario of petDeleteScenarios) {
      test(scenario.name, async ({ apiClient, validateSchema, apiConfig, credentials }) => {
        const ctx = buildTemplateContext(apiConfig);

        if (scenario.requiresAuth) {
          await login(apiClient, credentials.valid);
        }

        const setupResult = scenario.setup ? await scenario.setup({ apiClient }) : undefined;
        try {
          const pathParams = { ...resolveRecord(scenario.pathParams, ctx), ...setupResult?.pathParams };
          const path = buildPath(scenario.path, pathParams);

          const response = await apiClient.delete(path, { headers: resolveRecord(scenario.headers, ctx) });
          expect(response.status).toBe(scenario.expectedStatus);

          if (scenario.expectValidSchema !== undefined) {
            const result = await validateSchema({ method: 'DELETE', path: scenario.path, status: response.status }, response.body);
            expect(result.valid).toBe(scenario.expectValidSchema);
          }
        } finally {
          await setupResult?.teardown?.();
        }
      });
    }
  });
});
