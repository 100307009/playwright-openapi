import { test, expect } from '../../src/fixtures';
import { loadCachedSpec, findOperationByOperationId } from '../../src/spec/loadSpec';
import { contractCases, buildTemplateContext, resolveCase } from '../../src/spec/contractCases';

/**
 * One Playwright test per entry in src/spec/contractCases.ts, generated at
 * collection time from the spec that global-setup already fetched - not
 * written to disk, so there's nothing to regenerate or go stale. Adding
 * coverage for another operation is a config entry, not a new test file; see
 * contractCases.ts for what's already covered and why.
 *
 * Pure self-consistency, nothing pinned: each case sends its example request
 * and requires that whatever status comes back matches what the live spec
 * currently documents for that status - no pre-declared expected status, no
 * "this drift is fine" escape hatch. A currently-noncompliant operation fails
 * every run until it's actually fixed upstream, which is a deliberate choice
 * over the hand-written contract tests' style (which pin specific known
 * drift so it reads as a stable, understood baseline) - see README.md.
 *
 * Every case reuses the exact same `apiClient`, `validateSchema` and
 * `versionConfig` fixtures the hand-written contract/flow/UI suites use.
 */
function buildPath(template: string, pathParams: Record<string, string> = {}): string {
  return template.replace(/\{(\w+)\}/g, (_, key: string) => {
    if (!(key in pathParams)) {
      throw new Error(`Missing path param "${key}" for template "${template}" - add it to the case's pathParams.`);
    }
    return encodeURIComponent(pathParams[key]);
  });
}

test.describe('Contract (generated)', () => {
  for (const rawCase of contractCases) {
    test(`${rawCase.operationId} (${rawCase.name})`, async ({ apiClient, validateSchema, versionConfig }) => {
      const spec = loadCachedSpec(versionConfig.version);
      const resolved = findOperationByOperationId(spec, rawCase.operationId);
      expect(
        resolved,
        `operationId "${rawCase.operationId}" was not found in the ${versionConfig.version} spec - it may have ` +
          `been renamed or removed. Update src/spec/contractCases.ts.`,
      ).toBeTruthy();
      const { method, pathTemplate } = resolved!;

      const ctx = buildTemplateContext(versionConfig);
      const testCase = resolveCase(rawCase, ctx);

      // If this case mutates a real resource, it provisions its own here rather than reusing a
      // shared fixture - see contractCases.ts's `setup` docs. teardown (if any) always runs,
      // pass or fail, so the case never leaves state behind for the next run to trip over.
      const setupResult = rawCase.setup ? await rawCase.setup({ apiClient, ctx }) : undefined;
      try {
        const pathParams = { ...testCase.pathParams, ...setupResult?.pathParams };
        const path = buildPath(pathTemplate, pathParams);

        const response = await apiClient.request(method, path, {
          params: testCase.queryParams,
          headers: testCase.headers,
          data: testCase.body,
        });

        // No pinned expectation: whatever status actually came back, it must match what the
        // live spec documents for that status, right now. If it doesn't, that's real drift.
        const result = await validateSchema({ method, path: pathTemplate, status: response.status }, response.body);
        expect(result.errors, `${method} ${path} -> ${response.status}`).toEqual([]);
        expect(result.valid).toBe(true);
      } finally {
        await setupResult?.teardown?.();
      }
    });
  }
});
