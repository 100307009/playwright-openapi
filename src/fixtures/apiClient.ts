import { withAllure } from 'allure-fetch';

export interface ApiRequestOptions {
  headers?: Record<string, string>;
  data?: unknown;
  params?: Record<string, string | number | boolean>;
}

export interface ApiResponse<T = unknown> {
  status: number;
  headers: Record<string, string>;
  body: T;
}

/**
 * allure-fetch wraps `fetch` itself and records one "HTTP Exchange" Allure step
 * per call - method, URL, full request/response headers and bodies, timing -
 * with sensitive headers (authorization, api keys, cookies, ...) redacted by
 * default. That's the audit trail this suite needs, so ApiClient no longer
 * hand-rolls it; it just calls through this wrapped fetch.
 *
 * This does mean requests go through plain `fetch` rather than Playwright's
 * APIRequestContext, so they won't show up in a trace.zip's Network tab - the
 * Allure report is the audit trail for API calls here, traces remain useful
 * for the UI layer.
 */
const fetchWithAllure = withAllure(fetch, {
  attachmentName: (exchange) => `${exchange.request.method} ${new URL(exchange.request.url).pathname}`,
});

/**
 * Thin wrapper around fetch. Shared verbatim across contract, flow and
 * UI-driven-API-setup tests so every layer makes requests, and gets audit
 * attachments, the same way.
 */
export class ApiClient {
  constructor(private readonly baseUrl: string) {}

  private buildUrl(path: string, params?: ApiRequestOptions['params']): string {
    const url = new URL(/^https?:\/\//.test(path) ? path : `${this.baseUrl}${path}`);
    for (const [key, value] of Object.entries(params ?? {})) {
      url.searchParams.set(key, String(value));
    }
    return url.toString();
  }

  async request<T = unknown>(method: string, path: string, options: ApiRequestOptions = {}): Promise<ApiResponse<T>> {
    const url = this.buildUrl(path, options.params);
    const headers: Record<string, string> = { ...options.headers };

    let body: string | undefined;
    if (options.data !== undefined) {
      body = JSON.stringify(options.data);
      headers['content-type'] ??= 'application/json';
    }

    const response = await fetchWithAllure(url, { method, headers, body });
    const status = response.status;
    const responseHeaders = Object.fromEntries(response.headers.entries());

    const rawText = await response.text();
    let parsedBody: unknown = null;
    if (rawText) {
      try {
        parsedBody = JSON.parse(rawText);
      } catch {
        parsedBody = rawText; // non-JSON response (e.g. text/plain, XML) - kept as-is
      }
    }

    return { status, headers: responseHeaders, body: parsedBody as T };
  }

  get<T = unknown>(path: string, options?: ApiRequestOptions) {
    return this.request<T>('GET', path, options);
  }

  post<T = unknown>(path: string, options?: ApiRequestOptions) {
    return this.request<T>('POST', path, options);
  }

  put<T = unknown>(path: string, options?: ApiRequestOptions) {
    return this.request<T>('PUT', path, options);
  }

  delete<T = unknown>(path: string, options?: ApiRequestOptions) {
    return this.request<T>('DELETE', path, options);
  }
}
