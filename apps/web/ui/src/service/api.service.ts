/// <reference types="vite/client" />
import { refreshSession } from "./auth.service";

/** An API request failure with a message and HTTP status code. */
export class ApiError extends Error {
  readonly status: number;

  constructor(message: string, status: number) {
    super(message);
    this.name = "ApiError";
    this.status = status;
  }
}

const configuredApiUrl = import.meta.env.VITE_API_BASE_URL?.trim();
const apiBaseUrl = configuredApiUrl || (import.meta.env.DEV ? "http://localhost:3000" : "");
const ACCESS_TOKEN_STORAGE_KEY = "quiescent_access_token";

// Keep a local copy so requests do not need to read browser storage each time.
let accessToken: string | null;

try {
  accessToken = window.localStorage.getItem(ACCESS_TOKEN_STORAGE_KEY);
} catch {
  accessToken = null;
}

const authLossListeners = new Set<() => void>();

/** Builds an absolute API URL, using localhost as the development fallback. */
export function apiUrl(path: string): string {
  if (!apiBaseUrl) throw new Error("VITE_API_BASE_URL must be configured for production builds");
  return new URL(path.replace(/^\//, ""), `${apiBaseUrl.replace(/\/$/, "")}/`).toString();
}

/** Saves the access token in memory and localStorage; null removes it from both. */
export function setAccessToken(value: string | null): void {
  accessToken = value;
  try {
    if (value) window.localStorage.setItem(ACCESS_TOKEN_STORAGE_KEY, value);
    else window.localStorage.removeItem(ACCESS_TOKEN_STORAGE_KEY);
  } catch {
    // Keep the in-memory session usable when browser storage is unavailable.
  }
}

/** Removes the saved access token from memory and browser storage. */
export function clearAccessToken(): void {
  setAccessToken(null);
}

/**
 * Registers a callback for when refresh fails or a retried request returns 401.
 *
 * @param listener Callback to run after authentication is lost.
 * @returns A function that removes the callback from the auth-loss notifications.
 */
export function subscribeToAuthLoss(listener: () => void): () => void {
  authLossListeners.add(listener);
  return () => authLossListeners.delete(listener);
}

/** Notifies all registered listeners that the user's session is no longer valid. */
function notifyAuthLost(): void {
  for (const listener of authLossListeners) listener();
}

/**
 * Reads a JSON response and throws ApiError for an unsuccessful HTTP status.
 */
export async function parseResponse<T>(response: Response): Promise<T> {
  const payload = await response.json().catch(() => null) as unknown;
  if (!response.ok) {
    const message = payload && typeof payload === "object" && "error" in payload &&
      payload.error && typeof payload.error === "object" && "message" in payload.error &&
      typeof payload.error.message === "string"
      ? payload.error.message
      : "The request could not be completed. Try again.";
    throw new ApiError(message, response.status);
  }
  return payload as T;
}

/**
 * Sends a request with the saved access token and includes browser cookies.
 * On 401, refreshes the session and retries once with the new access token.
 * Notifies auth-loss subscribers if refresh fails or the retry also returns 401.
 *
 * @param path API path, such as "articles" or "users/me".
 * @param init Fetch options, such as method, headers, and a JSON body.
 * @returns The parsed response payload.
 */
export async function apiRequest<T>(path: string, init: RequestInit = {}): Promise<T> {
  const send = (token: string | null) => {
    const headers = new Headers(init.headers);
    if (token) headers.set("Authorization", `Bearer ${token}`);
    return fetch(apiUrl(path), { ...init, headers, credentials: "include" });
  };

  let response = await send(accessToken);
  if (response.status !== 401) return parseResponse<T>(response);
  // A 401 may mean the access token expired. Try refreshing before signing out.
  const session = await refreshSession();
  if (!session) {
    notifyAuthLost();
    throw new ApiError("Your session has expired. Sign in again.", 401);
  }
  // Retry only once so an invalid session cannot cause an endless refresh loop.
  response = await send(session.accessToken);
  if (response.status === 401) {
    clearAccessToken();
    notifyAuthLost();
  }
  return parseResponse<T>(response);
}
