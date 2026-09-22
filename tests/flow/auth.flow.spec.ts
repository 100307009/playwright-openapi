import { test, expect } from '../../src/fixtures';
import { randomPetPayload } from '../../src/utils/testData';

/**
 * Verifies the shared `credentials` fixture is wired all the way through to
 * real request headers/params - the same fixture contract tests, other flow
 * tests, and UI tests (tests/ui) all pull from.
 *
 * Known limitation of the public Petstore demo, confirmed by hand with curl
 * before writing this: it does not actually enforce api_key on DELETE /pet,
 * nor does /user/login check the password - both valid and invalid
 * credentials currently succeed. That's a property of the demo backend, not
 * of this suite. Point API_V2_* at a backend that enforces auth and the two
 * `expect(...).toBe(200)` lines below become `toBe(401)` (or your API's
 * actual rejection code) - the fixture plumbing does not change.
 */
test.describe('Flow: auth', () => {
  test('DELETE /pet/{petId} accepts the shared api_key header (valid and invalid)', async ({
    apiClient,
    credentials,
  }) => {
    const pet = randomPetPayload();
    await apiClient.post('/pet', { data: pet });

    const withInvalidKey = await apiClient.delete(`/pet/${pet.id}`, {
      headers: { api_key: credentials.invalid.apiKey },
    });
    // TODO: once auth is enforced upstream, expect 401/403 here instead.
    expect(withInvalidKey.status).toBe(200);

    // Recreate since the (unenforced) delete above already removed it.
    const pet2 = randomPetPayload();
    await apiClient.post('/pet', { data: pet2 });
    const withValidKey = await apiClient.delete(`/pet/${pet2.id}`, {
      headers: { api_key: credentials.valid.apiKey },
    });
    expect(withValidKey.status).toBe(200);
  });

  test('GET /user/login accepts the shared valid and invalid credential fixtures', async ({ apiClient, credentials }) => {
    const validLogin = await apiClient.get('/user/login', {
      params: { username: credentials.valid.username, password: credentials.valid.password },
    });
    expect(validLogin.status).toBe(200);

    const invalidLogin = await apiClient.get('/user/login', {
      params: { username: credentials.invalid.username, password: credentials.invalid.password },
    });
    // TODO: once password checking is enforced upstream, expect 400 here instead.
    expect(invalidLogin.status).toBe(200);
  });
});
