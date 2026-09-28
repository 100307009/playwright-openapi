import * as fs from 'fs';
import * as path from 'path';
import * as yaml from 'js-yaml';
import RefParser from '@apidevtools/json-schema-ref-parser';
import { getSpecCacheDir, getApiConfig } from '../config/env';

export interface OpenApiDocument {
  openapi?: string;
  swagger?: string;
  paths: Record<string, Record<string, any>>;
  components?: { schemas?: Record<string, any> };
  [key: string]: any;
}

function cachePath(): string {
  return path.resolve(getSpecCacheDir(), 'spec.json');
}

/**
 * Fetches the OpenAPI spec, fully dereferences all $refs (so downstream
 * schema validation never has to resolve $ref itself), and writes the result
 * to the on-disk cache. Called once from global-setup per run.
 */
export async function fetchAndCacheSpec(): Promise<void> {
  const config = getApiConfig();
  if (!config) return; // not configured - nothing to do

  const response = await fetch(config.specUrl);
  if (!response.ok) {
    throw new Error(`Failed to fetch OpenAPI spec from ${config.specUrl}: ${response.status} ${response.statusText}`);
  }
  const raw = await response.text();
  const parsed = yaml.load(raw) as OpenApiDocument; // yaml.load also parses plain JSON

  const dereferenced = (await RefParser.dereference(parsed as any)) as OpenApiDocument;

  const target = cachePath();
  fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.writeFileSync(target, JSON.stringify(dereferenced, null, 2), 'utf-8');
}

let memoryCache: OpenApiDocument | undefined;

/** Reads the cached, dereferenced spec. Must run after global-setup. */
export function loadCachedSpec(): OpenApiDocument {
  if (memoryCache) return memoryCache;

  const target = cachePath();
  if (!fs.existsSync(target)) {
    throw new Error(`No cached OpenAPI spec at ${target}. Did global-setup run, and is API_SPEC_URL configured in .env?`);
  }
  memoryCache = JSON.parse(fs.readFileSync(target, 'utf-8')) as OpenApiDocument;
  return memoryCache;
}
