import { ApiConfig } from '../config/env';

export type TemplateContext = Record<string, string>;

/** The tokens a scenario's `{{token}}` placeholders can resolve to, sourced from the live config. */
export function buildTemplateContext(config: ApiConfig): TemplateContext {
  return {
    existingPetId: config.fixtures.existingPetId,
    nonexistentPetId: config.fixtures.nonexistentPetId,
    validApiKey: config.credentials.valid.apiKey,
    invalidApiKey: config.credentials.invalid.apiKey,
    validUsername: config.credentials.valid.username,
    validPassword: config.credentials.valid.password,
    invalidUsername: config.credentials.invalid.username,
    invalidPassword: config.credentials.invalid.password,
  };
}

function resolveValue(value: string, ctx: TemplateContext): string {
  const match = value.match(/^\{\{(\w+)\}\}$/);
  if (!match) return value;
  const token = match[1];
  if (!(token in ctx)) {
    throw new Error(`Unknown template token "{{${token}}}" in a test data scenario. Known tokens: ${Object.keys(ctx).join(', ')}`);
  }
  return ctx[token];
}

/** Resolves `{{token}}` placeholders in every string value of a plain string record (pathParams/headers). */
export function resolveRecord(record: Record<string, string> | undefined, ctx: TemplateContext): Record<string, string> | undefined {
  if (!record) return record;
  return Object.fromEntries(Object.entries(record).map(([key, value]) => [key, resolveValue(value, ctx)]));
}

/** Same as resolveRecord, but for queryParams, whose values may be non-string and pass through untouched. */
export function resolveQueryParams(
  record: Record<string, string | number | boolean> | undefined,
  ctx: TemplateContext,
): Record<string, string | number | boolean> | undefined {
  if (!record) return record;
  return Object.fromEntries(
    Object.entries(record).map(([key, value]) => [key, typeof value === 'string' ? resolveValue(value, ctx) : value]),
  );
}

/** A scenario's `body` may be a literal value or a `() => value` factory for run-time-unique payloads. */
export function resolveBody(body: unknown): unknown {
  return typeof body === 'function' ? (body as () => unknown)() : body;
}
