import * as fs from 'fs';
import * as path from 'path';
import * as yaml from 'js-yaml';
import RefParser from '@apidevtools/json-schema-ref-parser';
import { ApiVersion, getSpecCacheDir, getVersionConfig } from '../config/env';

export interface OpenApiDocument {
  openapi?: string;
  swagger?: string;
  paths: Record<string, Record<string, any>>;
  components?: { schemas?: Record<string, any> };
  [key: string]: any;
}

function cachePath(version: ApiVersion): string {
  return path.resolve(getSpecCacheDir(), `${version}.json`);
}

/**
 * Fetches the OpenAPI spec for a version, fully dereferences all $refs (so
 * downstream schema validation never has to resolve $ref itself), and writes
 * the result to the on-disk cache. Called once from global-setup per run.
 */
export async function fetchAndCacheSpec(version: ApiVersion): Promise<void> {
  const config = getVersionConfig(version);
  if (!config) return; // version not wired up - nothing to do

  const response = await fetch(config.specUrl);
  if (!response.ok) {
    throw new Error(
      `Failed to fetch OpenAPI spec for ${version} from ${config.specUrl}: ${response.status} ${response.statusText}`,
    );
  }
  const raw = await response.text();
  const parsed = yaml.load(raw) as OpenApiDocument; // yaml.load also parses plain JSON

  const dereferenced = (await RefParser.dereference(parsed as any)) as OpenApiDocument;

  const target = cachePath(version);
  fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.writeFileSync(target, JSON.stringify(dereferenced, null, 2), 'utf-8');
}

const memoryCache = new Map<ApiVersion, OpenApiDocument>();

/** Reads the cached, dereferenced spec for a version. Must run after global-setup. */
export function loadCachedSpec(version: ApiVersion): OpenApiDocument {
  const cached = memoryCache.get(version);
  if (cached) return cached;

  const target = cachePath(version);
  if (!fs.existsSync(target)) {
    throw new Error(
      `No cached OpenAPI spec for ${version} at ${target}. Did global-setup run, and is ` +
        `API_${version.toUpperCase()}_SPEC_URL configured in .env?`,
    );
  }
  const doc = JSON.parse(fs.readFileSync(target, 'utf-8')) as OpenApiDocument;
  memoryCache.set(version, doc);
  return doc;
}

export interface ResolvedOperation {
  method: string; // upper-case, e.g. "GET"
  pathTemplate: string; // e.g. "/pet/{petId}"
  operation: Record<string, any>;
}

/**
 * Finds an operation by its spec `operationId`, deriving the method and path
 * template rather than having callers hard-code them. Used by the generated
 * contract suite (tests/contract/generated.contract.spec.ts) so a case config
 * only needs to name the operationId it targets - if that operation is
 * renamed or removed from the spec, the generated test fails loudly instead
 * of silently testing the wrong (or a stale) endpoint.
 */
export function findOperationByOperationId(spec: OpenApiDocument, operationId: string): ResolvedOperation | undefined {
  for (const [pathTemplate, methods] of Object.entries(spec.paths)) {
    for (const [method, operation] of Object.entries(methods)) {
      if (operation && typeof operation === 'object' && operation.operationId === operationId) {
        return { method: method.toUpperCase(), pathTemplate, operation };
      }
    }
  }
  return undefined;
}
