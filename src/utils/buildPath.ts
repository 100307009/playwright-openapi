/** Fills a templated OpenAPI path (e.g. "/pet/{petId}") with concrete values. */
export function buildPath(template: string, pathParams: Record<string, string> = {}): string {
  return template.replace(/\{(\w+)\}/g, (_, key: string) => {
    if (!(key in pathParams)) {
      throw new Error(`Missing path param "${key}" for template "${template}" - add it to the scenario's pathParams.`);
    }
    return encodeURIComponent(pathParams[key]);
  });
}
