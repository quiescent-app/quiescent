/// <reference types="vite/client" />

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

function readStoredAccessToken(): string | null {
  try {
    return window.localStorage.getItem(ACCESS_TOKEN_STORAGE_KEY);
  } catch {
    return null;
  }
}

let accessToken: string | null = readStoredAccessToken();
let refreshAccessToken: (() => Promise<string | null>) | null = null;
const authLossListeners = new Set<() => void>();

export function apiUrl(path: string): string {
  if (!apiBaseUrl) throw new Error("VITE_API_BASE_URL must be configured for production builds");
  return new URL(path.replace(/^\//, ""), `${apiBaseUrl.replace(/\/$/, "")}/`).toString();
}

export function setAccessToken(value: string | null): void {
  accessToken = value;
  try {
    if (value) window.localStorage.setItem(ACCESS_TOKEN_STORAGE_KEY, value);
    else window.localStorage.removeItem(ACCESS_TOKEN_STORAGE_KEY);
  } catch {
    // Keep the in-memory session usable when browser storage is unavailable.
  }
}

export function clearAccessToken(): void {
  setAccessToken(null);
}

export function configureAccessTokenRefresh(refresh: () => Promise<string | null>): void {
  refreshAccessToken = refresh;
}

export function subscribeToAuthLoss(listener: () => void): () => void {
  authLossListeners.add(listener);
  return () => authLossListeners.delete(listener);
}

function notifyAuthLost(): void {
  for (const listener of authLossListeners) listener();
}

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

export async function apiRequest<T>(path: string, init: RequestInit = {}): Promise<T> {
  const send = (token: string | null) => {
    const headers = new Headers(init.headers);
    if (token) headers.set("Authorization", `Bearer ${token}`);
    return fetch(apiUrl(path), { ...init, headers, credentials: "include" });
  };

  let response = await send(accessToken);
  if (response.status !== 401) return parseResponse<T>(response);

  const refreshedToken = refreshAccessToken ? await refreshAccessToken() : null;
  if (!refreshedToken) {
    notifyAuthLost();
    throw new ApiError("Your session has expired. Sign in again.", 401);
  }

  response = await send(refreshedToken);
  if (response.status === 401) {
    clearAccessToken();
    notifyAuthLost();
  }
  return parseResponse<T>(response);
}
