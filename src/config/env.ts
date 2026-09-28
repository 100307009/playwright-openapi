import * as dotenv from 'dotenv';
import * as path from 'path';

dotenv.config({ path: path.resolve(__dirname, '../../.env') });

export interface ApiConfig {
  specUrl: string;
  baseUrl: string;
  credentials: {
    valid: { apiKey: string; username: string; password: string };
    invalid: { apiKey: string; username: string; password: string };
  };
  fixtures: {
    existingPetId: string;
    nonexistentPetId: string;
  };
}

function readEnv(name: string): string | undefined {
  const value = process.env[name];
  return value === undefined || value === '' ? undefined : value;
}

/** Returns the suite's API config, or undefined if it hasn't been configured in .env yet. */
export function getApiConfig(): ApiConfig | undefined {
  const baseUrl = readEnv('API_BASE_URL');
  const specUrl = readEnv('API_SPEC_URL');
  if (!baseUrl || !specUrl) return undefined;

  return {
    specUrl,
    baseUrl,
    credentials: {
      valid: {
        apiKey: readEnv('API_VALID_API_KEY') ?? '',
        username: readEnv('API_VALID_USERNAME') ?? '',
        password: readEnv('API_VALID_PASSWORD') ?? '',
      },
      invalid: {
        apiKey: readEnv('API_INVALID_API_KEY') ?? '',
        username: readEnv('API_INVALID_USERNAME') ?? '',
        password: readEnv('API_INVALID_PASSWORD') ?? '',
      },
    },
    fixtures: {
      existingPetId: readEnv('API_EXISTING_PET_ID') ?? '1',
      nonexistentPetId: readEnv('API_NONEXISTENT_PET_ID') ?? '999999999',
    },
  };
}

/** Throws with a clear message - use where the suite truly can't proceed without config. */
export function requireApiConfig(): ApiConfig {
  const config = getApiConfig();
  if (!config) {
    throw new Error('API is not configured. Set API_BASE_URL and API_SPEC_URL in .env (see .env.example).');
  }
  return config;
}

export function getUiBaseUrl(): string | undefined {
  return readEnv('UI_BASE_URL');
}

export function getSpecCacheDir(): string {
  return readEnv('SPEC_CACHE_DIR') ?? '.cache/specs';
}
