import { test, expect } from '../../src/fixtures';
import { randomPetPayload } from '../../src/utils/testData';
import type { components } from '../../src/types/api-v2';

type Pet = components['schemas']['Pet'];

/**
 * Contract tests check ONE thing: does what the live server actually sends
 * back match what the OpenAPI spec documents for that status code? They are
 * intentionally decoupled from business-logic correctness (see tests/flow)
 * so a spec/implementation drift shows up here first, cheaply, without a
 * multi-step scenario failing further down the suite.
 */
test.describe('Contract: /pet', () => {
  test('GET /pet/{petId} - 200 for an existing pet matches the Pet schema', async ({
    apiClient,
    validateSchema,
    fixtureIds,
  }) => {
    const response = await apiClient.get<Pet>(`/pet/${fixtureIds.existingPetId}`);
    expect(response.status).toBe(200);
    // response.body is typed as Pet here - e.g. response.body.name is a compile-time string,
    // catching a spec/field-name mismatch while writing the test rather than at run time.

    const result = await validateSchema({ method: 'GET', path: '/pet/{petId}', status: response.status }, response.body);
    expect(result.errors).toEqual([]);
    expect(result.valid).toBe(true);
  });

  test('GET /pet/{petId} - 404 for an unknown pet (known spec gap: undocumented body)', async ({
    apiClient,
    validateSchema,
    fixtureIds,
  }) => {
    const response = await apiClient.get(`/pet/${fixtureIds.nonexistentPetId}`);
    expect(response.status).toBe(404);

    const result = await validateSchema({ method: 'GET', path: '/pet/{petId}', status: response.status }, response.body);
    // The live spec documents 404 as a valid status for this operation, but declares no
    // application/json content for it. The live server nonetheless returns a body
    // ("Pet not found"). That's a real, current drift between spec and implementation -
    // this assertion pins it down so it's visible if either side changes.
    expect(result.statusDocumented).toBe(true);
    expect(result.schemaDocumented).toBe(false);
    expect(result.valid).toBe(false);
  });

  test('POST /pet - 200 create matches the Pet schema', async ({ apiClient, validateSchema }) => {
    const payload = randomPetPayload();
    const response = await apiClient.post('/pet', { data: payload });
    expect(response.status).toBe(200);

    const result = await validateSchema({ method: 'POST', path: '/pet', status: response.status }, response.body);
    expect(result.errors).toEqual([]);
    expect(result.valid).toBe(true);

    await apiClient.delete(`/pet/${payload.id}`); // cleanup
  });

  test('POST /pet - malformed payload (known spec gap: undocumented 500)', async ({ apiClient, validateSchema }) => {
    const response = await apiClient.post('/pet', { data: { thisIsNot: 'a valid pet' } });

    const result = await validateSchema({ method: 'POST', path: '/pet', status: response.status }, response.body);
    // The public demo currently 500s on malformed input instead of the documented 400/422,
    // and its "default" error response also declares no content schema. Real contract
    // testing value: this fails loudly the moment the upstream team documents (or fixes)
    // this behaviour, instead of silently drifting.
    expect(response.status).toBe(500);
    expect(result.statusDocumented).toBe(false);
    expect(result.valid).toBe(false);
  });

  test('PUT /pet - 200 update matches the Pet schema', async ({ apiClient, validateSchema }) => {
    const created = randomPetPayload();
    await apiClient.post('/pet', { data: created });

    const response = await apiClient.put('/pet', { data: { ...created, name: `${created.name}-updated` } });
    expect(response.status).toBe(200);

    const result = await validateSchema({ method: 'PUT', path: '/pet', status: response.status }, response.body);
    expect(result.errors).toEqual([]);
    expect(result.valid).toBe(true);

    await apiClient.delete(`/pet/${created.id}`); // cleanup
  });

  test('GET /pet/findByStatus - 200 returns a freshly created pet with the right shape', async ({ apiClient }) => {
    // The public demo is shared with every other client testing against it, and its
    // findByStatus results accumulate malformed entries from other testers over time
    // (missing required fields, wrong types) - real, ongoing data drift, but not something
    // this suite controls or should flake on. So rather than strictly schema-validating the
    // entire shared array, we confirm the one pet we created ourselves round-trips through
    // this endpoint with the right shape - the part of the contract we actually own here.
    const pet = randomPetPayload({ status: 'available' });
    await apiClient.post('/pet', { data: pet });

    const response = await apiClient.get<Pet[]>('/pet/findByStatus', { params: { status: 'available' } });
    expect(response.status).toBe(200);
    expect(Array.isArray(response.body)).toBe(true);

    const ours = response.body.find((p) => p.id === pet.id);
    expect(ours).toMatchObject({ id: pet.id, name: pet.name, status: 'available' });

    await apiClient.delete(`/pet/${pet.id}`); // cleanup
  });
});
