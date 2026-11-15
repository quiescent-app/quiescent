import {
  apiUrl,
  configureAccessTokenRefresh,
  parseResponse,
  setAccessToken,
} from "./api.service";

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

export { ApiError as AuthApiError } from "./api.service";

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

let refreshInFlight: Promise<AuthSession | null> | null = null;

export function refreshSession(): Promise<AuthSession | null> {
  if (!refreshInFlight) {
    refreshInFlight = requestSession("auth/refresh")
      .catch(() => {
        setAccessToken(null);
        return null;
      })
      .finally(() => {
        refreshInFlight = null;
      });
  }
  return refreshInFlight;
}

configureAccessTokenRefresh(async () => (await refreshSession())?.accessToken ?? null);

export async function logout(): Promise<void> {
  try {
    await fetch(apiUrl("auth/logout"), { method: "POST", credentials: "include" });
  } finally {
    setAccessToken(null);
  }
}
