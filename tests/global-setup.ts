import { fetchAndCacheSpec } from '../src/spec/loadSpec';
import { getApiConfig } from '../src/config/env';

/**
 * `fixtureIds.existingPetId` (see .env.example) is meant to be a pet that's always there on the
 * shared public Petstore demo. It isn't, reliably - this repo's own test run observed it vanish
 * mid-session (someone else's cleanup, a demo data reset, who knows - it's a shared, externally
 * owned server we don't control). Rather than let every test that reads it fail for a reason that
 * has nothing to do with spec drift, ensure it exists before the run starts.
 *
 * This is a Petstore-demo-specific convenience, not a general pattern: a real target API would
 * either own a test environment with durable seed data, or have its own equivalent "ensure the
 * fixtures this suite depends on actually exist" step here - the point is that a fixture ID
 * pulled from .env should never be assumed to be permanent unless something in the run actually
 * guarantees it.
 */
async function ensurePetFixtureExists(): Promise<void> {
  const config = getApiConfig();
  if (!config) return;

  const petId = config.fixtures.existingPetId;
  const check = await fetch(`${config.baseUrl}/pet/${petId}`);
  if (check.ok) return;

  console.log(`[global-setup] Fixture pet ${petId} not found (shared demo data can disappear) - recreating it.`);
  const seed = await fetch(`${config.baseUrl}/pet`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ id: Number(petId), name: 'fixture-pet', photoUrls: [], status: 'available' }),
  });
  if (!seed.ok) {
    console.warn(`[global-setup] Could not recreate fixture pet ${petId} (status ${seed.status}) - tests relying on it may fail.`);
  }
}

/**
 * Runs once before the whole test run (all projects). Fetches and caches the
 * OpenAPI spec so:
 *  - we fail fast, once, if the spec host is unreachable, instead of every test doing it
 *  - every test in the run validates against the exact same spec snapshot
 */
export default async function globalSetup(): Promise<void> {
  const config = getApiConfig();
  if (!config) {
    throw new Error('API is not configured. Set API_BASE_URL and API_SPEC_URL in .env (see .env.example).');
  }

  console.log(`[global-setup] Fetching OpenAPI spec from ${config.specUrl}`);
  await fetchAndCacheSpec();
  await ensurePetFixtureExists();
}
