import { ApiClient } from '../fixtures/apiClient';
import { VersionConfig } from '../config/env';

export type TemplateContext = Record<string, string>;

export interface ContractCaseTools {
  apiClient: ApiClient;
  ctx: TemplateContext;
}

export interface ContractCaseSetupResult {
  /** Merged over (and taking priority over) the case's own resolved pathParams. */
  pathParams?: Record<string, string>;
  /** Runs after the case's request completes - pass or fail - to clean up whatever setup created. */
  teardown?: () => Promise<void>;
}

export interface ContractCase {
  /** OpenAPI operationId - the generator looks up its method/path from the spec, not here. */
  operationId: string;
  /** Distinguishes multiple cases against the same operation, e.g. "existing" vs "unknown". */
  name: string;
  /**
   * Values for `{placeholders}` in the operation's path. A value wrapped in
   * `{{...}}` (e.g. "{{nonexistentPetId}}") is resolved at test-run time from
   * the active version's `fixtureIds`/`credentials` fixtures - the same ones
   * contract/flow/UI tests already share - so this config stays in sync with
   * .env instead of duplicating IDs. Anything else is used as a literal.
   */
  pathParams?: Record<string, string>;
  queryParams?: Record<string, string | number | boolean>;
  headers?: Record<string, string>;
  body?: unknown;
  /**
   * For a case whose operation mutates state (PATCH/PUT/DELETE, or a POST against a specific
   * existing resource) and genuinely needs a real target to act on: create a private, disposable
   * one here instead of pointing at a shared .env fixture (like `{{existingPetId}}`). Without
   * this, a case like "delete the existing pet" would succeed once and then fail on every
   * subsequent run/retry for a reason that has nothing to do with spec drift - it consumed the
   * only fixture pet other tests also rely on. `setup` runs immediately before the case's own
   * request; its `pathParams` are merged over the case's own, and `teardown` (if given) always
   * runs after, pass or fail - so the case is self-contained and safe to rerun indefinitely.
   */
  setup?: (tools: ContractCaseTools) => Promise<ContractCaseSetupResult>;
}

async function createDisposablePet(apiClient: ApiClient): Promise<string> {
  const id = Math.floor(Date.now() % 1_000_000) * 1000 + Math.floor(Math.random() * 1000);
  await apiClient.post('/pet', { data: { id, name: `contract-case-pet-${id}`, photoUrls: [], status: 'available' } });
  return String(id);
}

/**
 * What to send is the one thing that can't be derived from the spec alone -
 * an operation like `updatePetWithForm` needs a real `petId`, `POST /pet`
 * needs a body shaped like a Pet. What's expected back is NOT declared here:
 * the generated test (tests/contract/generated.contract.spec.ts) takes
 * whatever status the live call actually returns and checks it against
 * whatever the freshly-fetched spec currently documents for that status -
 * nothing pinned, nothing to keep in sync by hand. That means a case here can
 * legitimately fail every run until the real drift it's exercising is fixed
 * upstream - see README.md's "Why some tests are red" section for what that
 * looks like on the public Petstore demo today.
 */
export const contractCases: ContractCase[] = [
  { operationId: 'logoutUser', name: 'always succeeds' },
  {
    operationId: 'getUserByName',
    name: 'unknown username',
    pathParams: { username: 'definitely-not-a-real-user-xyz' },
  },
  {
    operationId: 'getOrderById',
    name: 'unknown order',
    pathParams: { orderId: '999999999' },
  },
  {
    operationId: 'findPetsByTags',
    name: 'by tag',
    queryParams: { tags: 'tag1' },
  },
  {
    operationId: 'updatePetWithForm',
    name: 'unknown pet',
    pathParams: { petId: '{{nonexistentPetId}}' },
    queryParams: { name: 'x', status: 'sold' },
  },
  {
    // Mutates a real resource, so it owns one via `setup` rather than touching the shared
    // `{{existingPetId}}` fixture - safe to rerun/retry indefinitely. No `teardown` needed:
    // the case's own request (the delete) is already the cleanup.
    operationId: 'deletePet',
    name: 'real pet, self-provisioned',
    setup: async ({ apiClient }) => ({ pathParams: { petId: await createDisposablePet(apiClient) } }),
  },
  {
    // Same self-provisioning pattern, but this mutation doesn't consume the resource, so
    // `teardown` deletes it afterwards - the case leaves nothing behind either way.
    operationId: 'updatePetWithForm',
    name: 'real pet, self-provisioned',
    queryParams: { name: 'renamed', status: 'sold' },
    setup: async ({ apiClient }) => {
      const petId = await createDisposablePet(apiClient);
      return { pathParams: { petId }, teardown: async () => void (await apiClient.delete(`/pet/${petId}`)) };
    },
  },
];

export function buildTemplateContext(config: VersionConfig): TemplateContext {
  return {
    existingPetId: config.fixtures.existingPetId,
    nonexistentPetId: config.fixtures.nonexistentPetId,
    validApiKey: config.credentials.valid.apiKey,
    invalidApiKey: config.credentials.invalid.apiKey,
    validUsername: config.credentials.valid.username,
    validPassword: config.credentials.valid.password,
    invalidUsername: config.credentials.invalid.username,
    invalidPassword: config.credentials.invalid.password,
  };
}

function resolveValue(value: string, ctx: TemplateContext): string {
  const match = value.match(/^\{\{(\w+)\}\}$/);
  if (!match) return value;
  const token = match[1];
  if (!(token in ctx)) {
    throw new Error(`Unknown template token "{{${token}}}" in a contract case. Known tokens: ${Object.keys(ctx).join(', ')}`);
  }
  return ctx[token];
}

function resolveRecord(record: Record<string, string> | undefined, ctx: TemplateContext): Record<string, string> | undefined {
  if (!record) return record;
  return Object.fromEntries(Object.entries(record).map(([key, value]) => [key, resolveValue(value, ctx)]));
}

export function resolveCase(testCase: ContractCase, ctx: TemplateContext): ContractCase {
  return { ...testCase, pathParams: resolveRecord(testCase.pathParams, ctx) };
}
