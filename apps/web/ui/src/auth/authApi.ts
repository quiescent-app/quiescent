export interface AuthUser {
  id: string;
  email: string;
  displayName: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface AuthSession {
  user: AuthUser;
  accessToken: string;
}

export interface Credentials {
  email: string;
  password: string;
}

export class AuthApiError extends Error {
  constructor(message: string, readonly status: number) {
    super(message);
    this.name = "AuthApiError";
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
let refreshInFlight: Promise<AuthSession | null> | null = null;
const authLossListeners = new Set<() => void>();

function apiUrl(path: string): string {
  if (!apiBaseUrl) throw new Error("VITE_API_BASE_URL must be configured for production builds");
  return new URL(path.replace(/^\//, ""), `${apiBaseUrl.replace(/\/$/, "")}/`).toString();
}

function notifyAuthLost(): void {
  for (const listener of authLossListeners) listener();
}

function setAccessToken(value: string | null): void {
  accessToken = value;
  try {
    if (value) window.localStorage.setItem(ACCESS_TOKEN_STORAGE_KEY, value);
    else window.localStorage.removeItem(ACCESS_TOKEN_STORAGE_KEY);
  } catch {
    // Keep the in-memory session usable when browser storage is unavailable.
  }
}

export function subscribeToAuthLoss(listener: () => void): () => void {
  authLossListeners.add(listener);
  return () => authLossListeners.delete(listener);
}

async function parseResponse<T>(response: Response): Promise<T> {
  const payload = await response.json().catch(() => null) as unknown;
  if (!response.ok) {
    const message = payload && typeof payload === "object" && "error" in payload &&
      payload.error && typeof payload.error === "object" && "message" in payload.error &&
      typeof payload.error.message === "string"
      ? payload.error.message
      : "The request could not be completed. Try again.";
    throw new AuthApiError(message, response.status);
  }
  return payload as T;
}

async function requestSession(path: string, credentials?: Credentials): Promise<AuthSession> {
  const response = await fetch(apiUrl(path), {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    ...(credentials ? { body: JSON.stringify(credentials) } : {}),
  });
  const session = await parseResponse<AuthSession>(response);
  setAccessToken(session.accessToken);
  return session;
}

export function login(credentials: Credentials): Promise<AuthSession> {
  return requestSession("auth/login", credentials);
}

export function signUp(credentials: Credentials): Promise<AuthSession> {
  return requestSession("auth/sign-up", credentials);
}

async function refreshOnce(): Promise<AuthSession | null> {
  try {
    const session = await requestSession("auth/refresh");
    return session;
  } catch {
    setAccessToken(null);
    return null;
  }
}

export function refreshSession(): Promise<AuthSession | null> {
  if (!refreshInFlight) {
    refreshInFlight = refreshOnce().finally(() => {
      refreshInFlight = null;
    });
  }
  return refreshInFlight;
}

export async function logout(): Promise<void> {
  try {
    await fetch(apiUrl("auth/logout"), { method: "POST", credentials: "include" });
  } finally {
    setAccessToken(null);
  }
}

export async function apiRequest<T>(path: string, init: RequestInit = {}): Promise<T> {
  const send = (token: string | null) => {
    const headers = new Headers(init.headers);
    if (token) headers.set("Authorization", `Bearer ${token}`);
    return fetch(apiUrl(path), { ...init, headers, credentials: "include" });
  };

  let response = await send(accessToken);
  if (response.status !== 401) return parseResponse<T>(response);

  const refreshed = await refreshSession();
  if (!refreshed) {
    notifyAuthLost();
    throw new AuthApiError("Your session has expired. Sign in again.", 401);
  }

  response = await send(refreshed.accessToken);
  if (response.status === 401) {
    setAccessToken(null);
    notifyAuthLost();
  }
  return parseResponse<T>(response);
}

export function clearAccessToken(): void {
  setAccessToken(null);
}
