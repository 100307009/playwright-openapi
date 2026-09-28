import { test, expect } from '../../src/fixtures';
import { randomPetPayload } from '../../src/utils/testData';
import type { components } from '../../src/types/api';

type Pet = components['schemas']['Pet'];

/**
 * Flow tests check business logic, not wire format: a 200 only proves the
 * server acknowledged the request, not that it did the right thing with it.
 * Every mutation below is followed by an INDEPENDENT read (a fresh GET) to
 * confirm the change actually persisted with the right data - never trusting
 * the mutating call's own response as proof.
 */
test.describe('Flow: pet lifecycle', () => {
  test('create -> read-back -> update -> read-back -> delete -> read-back confirms real state changes', async ({
    apiClient,
  }) => {
    const created = randomPetPayload();

    const createResponse = await apiClient.post('/pet', { data: created });
    expect(createResponse.status, 'create acknowledged').toBe(200);

    // Don't trust createResponse.body - independently re-fetch the resource.
    const afterCreate = await apiClient.get<Pet>(`/pet/${created.id}`);
    expect(afterCreate.status, 'pet is actually retrievable after creation').toBe(200);
    expect(afterCreate.body).toMatchObject({ id: created.id, name: created.name, status: 'available' });

    const updatedName = `${created.name}-updated`;
    const updateResponse = await apiClient.put('/pet', { data: { ...created, name: updatedName, status: 'sold' } });
    expect(updateResponse.status, 'update acknowledged').toBe(200);

    // Don't trust updateResponse.body either - re-fetch again.
    const afterUpdate = await apiClient.get<Pet>(`/pet/${created.id}`);
    expect(afterUpdate.status).toBe(200);
    expect(afterUpdate.body, 'the update actually persisted, not just echoed back').toMatchObject({
      id: created.id,
      name: updatedName,
      status: 'sold',
    });

    const deleteResponse = await apiClient.delete(`/pet/${created.id}`);
    expect(deleteResponse.status, 'delete acknowledged').toBe(200);

    // The only real proof of deletion: the resource is actually gone.
    const afterDelete = await apiClient.get(`/pet/${created.id}`);
    expect(afterDelete.status, 'pet is actually gone after deletion').toBe(404);
  });
});
