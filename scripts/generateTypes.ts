import * as fs from 'fs';
import * as path from 'path';
import openapiTS, { astToString } from 'openapi-typescript';
import { getVersionConfig } from '../src/config/env';

/**
 * Generates compile-time types from each configured version's OpenAPI spec,
 * to `src/types/api-<version>.d.ts`. Purely a DX/authoring-time aid (typed
 * request/response shapes when writing fixtures and test payloads) - it does
 * NOT replace runtime schema validation. A response can satisfy the type a
 * test assumed and still violate what the live server actually returns;
 * only src/spec/schemaValidator.ts (checked against the response you
 * actually got back) proves that. See README.md.
 */
async function main(): Promise<void> {
  const versions = ['v1', 'v2'] as const;
  const outDir = path.resolve(__dirname, '../src/types');
  fs.mkdirSync(outDir, { recursive: true });

  let generated = 0;
  for (const version of versions) {
    const config = getVersionConfig(version);
    if (!config) continue;

    const ast = await openapiTS(new URL(config.specUrl));
    const output = astToString(ast);
    const outFile = path.join(outDir, `api-${version}.d.ts`);
    fs.writeFileSync(outFile, output, 'utf-8');
    console.log(`[types:generate] ${version}: ${config.specUrl} -> ${path.relative(process.cwd(), outFile)}`);
    generated += 1;
  }

  if (generated === 0) {
    throw new Error('No API version is configured. Set at least API_V2_* in .env (see .env.example).');
  }
}

main().catch((err) => {
  console.error('[types:generate] failed:', err);
  process.exit(1);
});
