import { refreshSession } from "../service/auth.service";
import { notifyAuthLost } from "../auth/authEvents";
import { accessToken, clearAccessToken } from "../auth/tokenStore";
import { ApiError, apiUrl, parseResponse } from "./http";

export { ApiError } from "./http";

/**
 * Sends a request with the saved access token and includes browser cookies.
 * On 401, refreshes the session and retries once with the new access token.
 */
export async function apiRequest<T>(path: string, init: RequestInit = {}): Promise<T> {
  const send = (token: string | null) => {
    const headers = new Headers(init.headers);
    if (token) headers.set("Authorization", `Bearer ${token}`);
    return fetch(apiUrl(path), { ...init, headers, credentials: "include" });
  };

  let response = await send(accessToken);
  if (response.status !== 401) return parseResponse<T>(response);

  const session = await refreshSession();
  if (!session) {
    notifyAuthLost();
    throw new ApiError("Your session has expired. Sign in again.", 401);
  }

  response = await send(session.accessToken);
  if (response.status === 401) {
    clearAccessToken();
    notifyAuthLost();
  }
  return parseResponse<T>(response);
}
