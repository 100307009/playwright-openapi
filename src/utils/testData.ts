import type { components } from '../types/api-v2';

// Typed against the spec-generated Pet shape (see scripts/generateTypes.ts) so a field rename
// or a newly-required property in the spec breaks this at compile time, not at test run time.
type Pet = components['schemas']['Pet'];

/** A pet/order id unlikely to collide with seed data or other parallel test runs. */
export function randomId(): number {
  return Math.floor(Date.now() % 1_000_000) * 1000 + Math.floor(Math.random() * 1000);
}

export function randomPetPayload(overrides: Partial<Pet> = {}): Pet {
  const id = randomId();
  return {
    id,
    name: `contract-test-pet-${id}`,
    photoUrls: ['https://example.test/pets/placeholder.jpg'],
    status: 'available',
    ...overrides,
  };
}
