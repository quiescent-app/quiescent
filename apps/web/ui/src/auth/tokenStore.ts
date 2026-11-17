const ACCESS_TOKEN_STORAGE_KEY = "quiescent_access_token";

// Keep a local copy so requests do not need to read browser storage each time.
export let accessToken: string | null;

try {
  accessToken = window.localStorage.getItem(ACCESS_TOKEN_STORAGE_KEY);
} catch {
  accessToken = null;
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
