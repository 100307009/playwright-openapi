import { ApiClient } from '../fixtures/apiClient';

export interface ScenarioSetupResult {
  /** Merged over (and taking priority over) the scenario's own resolved pathParams. */
  pathParams?: Record<string, string>;
  /** Overrides the scenario's own `body`, e.g. with the real resource `setup` just created. */
  body?: unknown;
  /** Runs after the scenario's request completes - pass or fail - to clean up whatever setup created. */
  teardown?: () => Promise<void>;
}

/**
 * One request/expectation pair. Arrays of these are grouped by endpoint group
 * (pet/store/user) and by request method - see src/testData/*.testData.ts.
 * The spec files just loop over the array for their group+method and run
 * each one the same way, so adding coverage is adding an entry here, not a
 * new test.
 */
export interface Scenario {
  /** Test title - shows up as-is in the Playwright/Allure report. */
  name: string;
  /** Templated OpenAPI path, from src/spec/endpoints.ts - e.g. "/pet/{petId}". */
  path: string;
  /**
   * Values for `{placeholders}` in `path`. A value wrapped in `{{...}}` (e.g.
   * "{{nonexistentPetId}}") is resolved at test-run time from the live
   * `credentials`/`fixtureIds` fixtures via buildTemplateContext/resolveRecord
   * - see src/testData/templateContext.ts. Anything else is used as a literal.
   */
  pathParams?: Record<string, string>;
  /** Same `{{token}}` resolution as pathParams, applied to string values only. */
  queryParams?: Record<string, string | number | boolean>;
  /** Same `{{token}}` resolution as pathParams. */
  headers?: Record<string, string>;
  /** Request body. A function is called at test-run time instead of used literally - use this for
   *  payloads that must be unique per run (e.g. `() => randomPetPayload()`) rather than a value
   *  frozen once at module load. */
  body?: unknown;
  /** If true, the spec logs in (see src/steps/auth.steps.ts) before sending the request. */
  requiresAuth?: boolean;
  /** The exact status the live request is expected to return. */
  expectedStatus: number;
  /**
   * Whether the response body is expected to satisfy the schema the spec documents for
   * `expectedStatus`. Omit entirely for endpoints that return shared, externally-written data
   * (e.g. a search across every pet on a public demo) where whole-body schema validation isn't
   * meaningful - the scenario then only asserts on `expectedStatus`.
   */
  expectValidSchema?: boolean;
  /**
   * For a scenario whose request mutates a real resource (or needs one to act on) and genuinely
   * can't reuse a shared fixture (like `{{existingPetId}}`) without breaking on rerun: provision a
   * private, disposable one here. Runs immediately before the scenario's own request; its
   * `pathParams`/`body` are merged over (take priority over) the scenario's own, and `teardown`
   * (if given) always runs after, pass or fail - so the scenario is self-contained and safe to
   * rerun/retry indefinitely.
   */
  setup?: (tools: { apiClient: ApiClient }) => Promise<ScenarioSetupResult>;
}
