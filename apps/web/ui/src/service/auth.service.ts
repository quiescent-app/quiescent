import {
  apiUrl,
  parseResponse,
  setAccessToken,
} from "./api.service";
import type { AuthSession, Credentials } from "../types/auth";

export { ApiError as AuthApiError } from "./api.service";

/**
 * Posts to a session endpoint and saves the returned access token before resolving.
 * Uses fetch directly so a failed refresh cannot trigger another refresh attempt.
 * The browser sends and stores the HttpOnly refresh cookie automatically.
 */
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

/** Signs in and saves the access token returned with the user's session. */
export function login(credentials: Credentials): Promise<AuthSession> {
  return requestSession("auth/login", credentials);
}

/** Creates an account and saves the access token returned with the new session. */
export function signUp(credentials: Credentials): Promise<AuthSession> {
  return requestSession("auth/sign-up", credentials);
}

let refreshInFlight: Promise<AuthSession | null> | null = null;
const REFRESH_LOCK_NAME = "quiescent-auth-refresh";

/** Holds the browser-wide lock through response parsing and cookie rotation. */
function requestRefresh(): Promise<AuthSession> {
  if (navigator.locks) {
    return navigator.locks.request(REFRESH_LOCK_NAME, () => requestSession("auth/refresh"));
  }
  // Preserve refresh behavior in browsers and test environments without Web Locks.
  return requestSession("auth/refresh");
}

/**
 * Refreshes the session using the browser's HttpOnly refresh cookie.
 * Saves the new access token; the browser handles the rotated refresh cookie.
 * Concurrent callers wait for the same refresh request.
 * Uses the Web Locks API to ensure that only one refresh request is in flight at a time
 *  when multiple tabs or concurrent calls attempt to refresh the session.
 *
 * @returns The refreshed session, or null after clearing the access token on failure.
 */
export function refreshSession(): Promise<AuthSession | null> {
  if (!refreshInFlight) {
    refreshInFlight = requestRefresh()
      .catch(() => {
        setAccessToken(null);
        return null;
      })
      .finally(() => {
        // Allow a future caller to start a new refresh once this attempt finishes.
        refreshInFlight = null;
      });
  }
  return refreshInFlight;
}

/** Requests server-side logout and clears the local access token even if fetch fails. */
export async function logout(): Promise<void> {
  try {
    await fetch(apiUrl("auth/logout"), { method: "POST", credentials: "include" });
  } finally {
    setAccessToken(null);
  }
}
