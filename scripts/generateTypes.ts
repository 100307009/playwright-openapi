import * as fs from 'fs';
import * as path from 'path';
import openapiTS, { astToString } from 'openapi-typescript';
import { requireApiConfig } from '../src/config/env';

/**
 * Generates compile-time types from the OpenAPI spec, to `src/types/api.d.ts`. Purely a DX/
 * authoring-time aid (typed request/response shapes when writing fixtures and test payloads) - it
 * does NOT replace runtime schema validation. A response can satisfy the type a test assumed and
 * still violate what the live server actually returns; only src/spec/schemaValidator.ts (checked
 * against the response you actually got back) proves that. See README.md.
 */
async function main(): Promise<void> {
  const config = requireApiConfig();
  const outDir = path.resolve(__dirname, '../src/types');
  fs.mkdirSync(outDir, { recursive: true });

  const ast = await openapiTS(new URL(config.specUrl));
  const output = astToString(ast);
  const outFile = path.join(outDir, 'api.d.ts');
  fs.writeFileSync(outFile, output, 'utf-8');
  console.log(`[types:generate] ${config.specUrl} -> ${path.relative(process.cwd(), outFile)}`);
}

main().catch((err) => {
  console.error('[types:generate] failed:', err);
  process.exit(1);
});
