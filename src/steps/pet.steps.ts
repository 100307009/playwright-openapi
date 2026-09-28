import { ApiClient } from '../fixtures/apiClient';
import { ENDPOINTS } from '../spec/endpoints';
import { buildPath } from '../utils/buildPath';
import { randomPetPayload } from '../utils/testData';

/**
 * Creates a private, disposable pet for a scenario to act on. Used by mutating scenarios
 * (PUT/DELETE, or a POST against a specific existing pet) so they never touch a shared fixture
 * (like `{{existingPetId}}`) - without this, e.g. "delete the existing pet" would succeed once and
 * then fail on every later run/retry for a reason that has nothing to do with spec drift.
 */
export async function createDisposablePet(apiClient: ApiClient): Promise<string> {
  const payload = randomPetPayload();
  await apiClient.post(ENDPOINTS.pet.base, { data: payload });
  return String(payload.id);
}

export async function deletePet(apiClient: ApiClient, petId: string): Promise<void> {
  await apiClient.delete(buildPath(ENDPOINTS.pet.byId, { petId }));
}
