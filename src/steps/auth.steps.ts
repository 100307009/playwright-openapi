import { ApiClient, ApiResponse } from '../fixtures/apiClient';
import { ApiConfig } from '../config/env';
import { ENDPOINTS } from '../spec/endpoints';

/**
 * Logs in with the given credentials - the reusable "become authenticated" step that any scenario
 * with `requiresAuth: true` goes through first (see the `if (scenario.requiresAuth)` blocks in
 * tests/contract/*.contract.spec.ts). Note the public Petstore demo doesn't actually enforce a
 * session from this beyond accepting the call; this step exists so the suite is structured the way
 * a backend that does enforce one would need.
 */
export async function login(apiClient: ApiClient, credentials: { username: string; password: string }): Promise<ApiResponse> {
  return apiClient.get(ENDPOINTS.user.login, { params: { username: credentials.username, password: credentials.password } });
}

export async function logout(apiClient: ApiClient): Promise<ApiResponse> {
  return apiClient.get(ENDPOINTS.user.logout);
}
