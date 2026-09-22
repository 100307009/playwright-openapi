import * as dotenv from 'dotenv';
import * as path from 'path';

dotenv.config({ path: path.resolve(__dirname, '../../.env') });

export type ApiVersion = 'v1' | 'v2';

export interface VersionConfig {
  version: ApiVersion;
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

/**
 * Returns the config for an API version, or undefined if that version has no
 * base URL configured in .env (i.e. it hasn't been wired up yet).
 */
export function getVersionConfig(version: ApiVersion): VersionConfig | undefined {
  const prefix = `API_${version.toUpperCase()}_`;
  const baseUrl = readEnv(`${prefix}BASE_URL`);
  const specUrl = readEnv(`${prefix}SPEC_URL`);
  if (!baseUrl || !specUrl) return undefined;

  return {
    version,
    specUrl,
    baseUrl,
    credentials: {
      valid: {
        apiKey: readEnv(`${prefix}VALID_API_KEY`) ?? '',
        username: readEnv(`${prefix}VALID_USERNAME`) ?? '',
        password: readEnv(`${prefix}VALID_PASSWORD`) ?? '',
      },
      invalid: {
        apiKey: readEnv(`${prefix}INVALID_API_KEY`) ?? '',
        username: readEnv(`${prefix}INVALID_USERNAME`) ?? '',
        password: readEnv(`${prefix}INVALID_PASSWORD`) ?? '',
      },
    },
    fixtures: {
      existingPetId: readEnv(`${prefix}EXISTING_PET_ID`) ?? '1',
      nonexistentPetId: readEnv(`${prefix}NONEXISTENT_PET_ID`) ?? '999999999',
    },
  };
}

/** Throws with a clear message - use when a test/project truly requires this version to be configured. */
export function requireVersionConfig(version: ApiVersion): VersionConfig {
  const config = getVersionConfig(version);
  if (!config) {
    throw new Error(
      `API ${version} is not configured. Set API_${version.toUpperCase()}_BASE_URL and ` +
        `API_${version.toUpperCase()}_SPEC_URL in .env (see .env.example).`,
    );
  }
  return config;
}

export function getUiBaseUrl(version: ApiVersion): string | undefined {
  return readEnv(`UI_${version.toUpperCase()}_BASE_URL`);
}

export function getSpecCacheDir(): string {
  return readEnv('SPEC_CACHE_DIR') ?? '.cache/specs';
}
