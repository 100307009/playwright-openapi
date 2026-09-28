import Ajv, { ValidateFunction } from 'ajv';
import addFormats from 'ajv-formats';
import { loadCachedSpec, OpenApiDocument } from './loadSpec';

export interface OperationSelector {
  method: string; // GET, POST, ...
  /** The templated OpenAPI path, e.g. "/pet/{petId}" - NOT the concrete request URL. */
  path: string;
  status: number;
}

export interface SchemaValidationResult {
  /** false if method+path isn't documented in the spec at all. */
  documented: boolean;
  /** false if this exact status (and no "default") is documented for the operation. */
  statusDocumented: boolean;
  /** false if the documented response declares no application/json schema. */
  schemaDocumented: boolean;
  valid: boolean;
  errors: string[];
  schema?: unknown;
}

/**
 * OpenAPI 3.0 schemas use `nullable: true` instead of standard JSON Schema's
 * `type: [x, "null"]`. Ajv doesn't understand `nullable`, so rewrite it before
 * compiling. Recurses into the shapes a schema can nest through.
 */
function toJsonSchema(node: unknown): unknown {
  if (Array.isArray(node)) return node.map(toJsonSchema);
  if (node === null || typeof node !== 'object') return node;

  const schema: Record<string, unknown> = { ...(node as Record<string, unknown>) };

  if (schema.nullable === true) {
    delete schema.nullable;
    if (typeof schema.type === 'string') {
      schema.type = [schema.type, 'null'];
    } else if (Array.isArray(schema.type) && !schema.type.includes('null')) {
      schema.type = [...schema.type, 'null'];
    }
  }

  for (const key of ['properties', 'patternProperties'] as const) {
    if (schema[key] && typeof schema[key] === 'object') {
      const obj = schema[key] as Record<string, unknown>;
      schema[key] = Object.fromEntries(Object.entries(obj).map(([k, v]) => [k, toJsonSchema(v)]));
    }
  }
  if (schema.items) schema.items = toJsonSchema(schema.items);
  if (typeof schema.additionalProperties === 'object') {
    schema.additionalProperties = toJsonSchema(schema.additionalProperties);
  }
  for (const key of ['allOf', 'oneOf', 'anyOf'] as const) {
    if (Array.isArray(schema[key])) schema[key] = (schema[key] as unknown[]).map(toJsonSchema);
  }

  return schema;
}

let ajv: Ajv | undefined;
const validatorCache = new Map<string, ValidateFunction | null>();
const compileErrorCache = new Map<string, string>();

function getAjv(): Ajv {
  if (!ajv) {
    // strict: false - real OpenAPI schemas carry vendor keywords Ajv doesn't recognize (xml,
    // example, discriminator, ...); strict mode throws on those at compile time regardless of
    // whether the schema is otherwise valid. This is about tolerating OpenAPI's schema dialect,
    // not about loosening what gets validated - required/type/format checks below are unaffected.
    ajv = new Ajv({ strict: false, allErrors: true });
    addFormats(ajv);
  }
  return ajv;
}

function findOperation(spec: OpenApiDocument, method: string, templatePath: string) {
  const pathItem = spec.paths[templatePath];
  if (!pathItem) return undefined;
  return pathItem[method.toLowerCase()];
}

export function validateResponse(selector: OperationSelector, body: unknown): SchemaValidationResult {
  const spec = loadCachedSpec();
  const operation = findOperation(spec, selector.method, selector.path);

  if (!operation) {
    return {
      documented: false,
      statusDocumented: false,
      schemaDocumented: false,
      valid: false,
      errors: [`${selector.method} ${selector.path} is not documented in the OpenAPI spec at all.`],
    };
  }

  const responses = operation.responses ?? {};
  const statusKey = String(selector.status);
  const responseSpec = responses[statusKey] ?? responses.default;
  const statusDocumented = Boolean(responses[statusKey]);

  const bodyIsEmpty = body === undefined || body === null || body === '';

  if (!responseSpec) {
    return {
      documented: true,
      statusDocumented: false,
      schemaDocumented: false,
      valid: bodyIsEmpty,
      errors: bodyIsEmpty
        ? []
        : [
            `${selector.method} ${selector.path} returned status ${selector.status}, which is not ` +
              `documented for this operation (no matching status and no "default" response either), ` +
              `yet a response body was received. This is a spec/implementation mismatch.`,
          ],
    };
  }

  const schema = responseSpec.content?.['application/json']?.schema;

  if (!schema) {
    return {
      documented: true,
      statusDocumented,
      schemaDocumented: false,
      valid: bodyIsEmpty,
      errors: bodyIsEmpty
        ? []
        : [
            `${selector.method} ${selector.path} -> ${selector.status} has no application/json schema ` +
              `documented in the spec, but the server returned a body. Either the spec is missing the ` +
              `schema, or the server is returning undocumented content.`,
          ],
    };
  }

  const cacheKey = `${selector.method}:${selector.path}:${statusKey}`;
  let validateFn = validatorCache.get(cacheKey);
  if (validateFn === undefined) {
    let compileError: string | undefined;
    try {
      validateFn = getAjv().compile(toJsonSchema(schema) as object);
    } catch (err) {
      validateFn = null;
      compileError = err instanceof Error ? err.message : String(err);
      console.error(`[schemaValidator] Failed to compile schema for ${cacheKey}:`, err);
    }
    validatorCache.set(cacheKey, validateFn);
    if (compileError) compileErrorCache.set(cacheKey, compileError);
  }

  if (!validateFn) {
    return {
      documented: true,
      statusDocumented,
      schemaDocumented: true,
      valid: false,
      errors: [`Schema for ${selector.method} ${selector.path} -> ${statusKey} failed to compile: ${compileErrorCache.get(cacheKey)}`],
      schema,
    };
  }

  const valid = validateFn(body);
  const errors = (validateFn.errors ?? []).map(
    (e) => `${e.instancePath || '(root)'} ${e.message ?? ''} ${e.params ? JSON.stringify(e.params) : ''}`.trim(),
  );

  return { documented: true, statusDocumented, schemaDocumented: true, valid: Boolean(valid), errors, schema };
}
