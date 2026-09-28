import { ENDPOINTS } from '../spec/endpoints';
import { randomPetPayload } from '../utils/testData';
import { createDisposablePet, deletePet } from '../steps/pet.steps';
import { Scenario } from './types';

export const petGetScenarios: Scenario[] = [
  {
    name: 'existing pet returns 200 matching the Pet schema',
    path: ENDPOINTS.pet.byId,
    pathParams: { petId: '{{existingPetId}}' },
    expectedStatus: 200,
    expectValidSchema: true,
  },
  {
    // Known spec gap, verified by hand: 404 is a documented status for this operation, but the
    // spec declares no response content for it. The live server returns a body anyway.
    name: 'unknown pet returns 404 with an undocumented body (known spec gap)',
    path: ENDPOINTS.pet.byId,
    pathParams: { petId: '{{nonexistentPetId}}' },
    expectedStatus: 404,
    expectValidSchema: false,
  },
  {
    // Body intentionally not schema-checked: this searches across every pet other testers have
    // ever created on the shared public demo, which accumulates malformed entries over time - real
    // data drift, but not something this suite controls or should flake on.
    name: 'find by tag returns 200',
    path: ENDPOINTS.pet.findByTags,
    queryParams: { tags: 'tag1' },
    expectedStatus: 200,
  },
  {
    // Same reasoning as "find by tag" above - shared demo data, status-only check.
    name: 'find by status returns 200',
    path: ENDPOINTS.pet.findByStatus,
    queryParams: { status: 'available' },
    expectedStatus: 200,
  },
];

export const petPostScenarios: Scenario[] = [
  {
    // `body` comes from `setup` (a fresh payload per run) rather than a literal here, so the
    // created pet's id is known for `teardown` to clean up afterwards.
    name: 'create matches the Pet schema',
    path: ENDPOINTS.pet.base,
    expectedStatus: 200,
    expectValidSchema: true,
    setup: async ({ apiClient }) => {
      const pet = randomPetPayload();
      return { body: pet, teardown: async () => void (await deletePet(apiClient, String(pet.id))) };
    },
  },
  {
    // Known spec gap, verified by hand: the demo 500s on malformed input instead of a documented
    // 400/422, and its "default" error response also declares no content schema.
    name: 'malformed payload 500s with an undocumented body (known spec gap)',
    path: ENDPOINTS.pet.base,
    body: { thisIsNot: 'a valid pet' },
    expectedStatus: 500,
    expectValidSchema: false,
  },
  {
    // updatePetWithForm: mutates a real resource, so it provisions and cleans up its own pet
    // rather than touching the shared `{{existingPetId}}` fixture - safe to rerun/retry
    // indefinitely. Exercises the same api_key auth header the DELETE scenarios below use.
    name: 'update via form on a real, self-provisioned pet matches the Pet schema',
    path: ENDPOINTS.pet.byId,
    queryParams: { name: 'renamed', status: 'sold' },
    requiresAuth: true,
    headers: { api_key: '{{validApiKey}}' },
    expectedStatus: 200,
    expectValidSchema: true,
    setup: async ({ apiClient }) => {
      const petId = await createDisposablePet(apiClient);
      return { pathParams: { petId }, teardown: async () => void (await deletePet(apiClient, petId)) };
    },
  },
  {
    // Known spec gap, verified by hand: this operation documents no 404 response at all (only
    // 200/400/default), yet the live server returns 404 with a body for an unknown pet.
    name: 'update via form on an unknown pet 404s with an undocumented body (known spec gap)',
    path: ENDPOINTS.pet.byId,
    pathParams: { petId: '{{nonexistentPetId}}' },
    queryParams: { name: 'x', status: 'sold' },
    expectedStatus: 404,
    expectValidSchema: false,
  },
];

export const petPutScenarios: Scenario[] = [
  {
    name: 'update a real, self-provisioned pet matches the Pet schema',
    path: ENDPOINTS.pet.base,
    expectedStatus: 200,
    expectValidSchema: true,
    setup: async ({ apiClient }) => {
      const pet = randomPetPayload();
      await apiClient.post(ENDPOINTS.pet.base, { data: pet });
      const updated = { ...pet, name: `${pet.name}-updated`, status: 'sold' };
      return { body: updated, teardown: async () => void (await deletePet(apiClient, String(pet.id))) };
    },
  },
];

export const petDeleteScenarios: Scenario[] = [
  {
    // Mirrors what used to be tests/flow/auth.flow.spec.ts: the demo doesn't actually enforce
    // api_key on DELETE /pet (both valid and invalid keys currently succeed) - a property of the
    // demo backend, not of this suite. Point the API at a backend that enforces auth and this
    // becomes `expectedStatus: 401` (or your API's real rejection code); the `requiresAuth` +
    // header plumbing does not change.
    name: 'delete a real, self-provisioned pet with a valid api_key succeeds (body undocumented)',
    path: ENDPOINTS.pet.byId,
    requiresAuth: true,
    headers: { api_key: '{{validApiKey}}' },
    expectedStatus: 200,
    expectValidSchema: false, // DELETE /pet declares no response content; live body is "Pet deleted"
    setup: async ({ apiClient }) => ({ pathParams: { petId: await createDisposablePet(apiClient) } }),
  },
  {
    // TODO: once auth is enforced upstream, expect 401/403 here instead - see the valid-key case above.
    name: 'delete a real, self-provisioned pet with an invalid api_key still succeeds upstream (auth not enforced)',
    path: ENDPOINTS.pet.byId,
    requiresAuth: true,
    headers: { api_key: '{{invalidApiKey}}' },
    expectedStatus: 200,
    expectValidSchema: false,
    setup: async ({ apiClient }) => ({ pathParams: { petId: await createDisposablePet(apiClient) } }),
  },
];
