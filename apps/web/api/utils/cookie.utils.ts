export const REFRESH_COOKIE_NAME = "quiescent_refresh";
export const REFRESH_COOKIE_MAX_AGE_MS = 30 * 24 * 60 * 60 * 1000;

/**
 * Reads the refresh token from a Cookie header, for example:
 * `POST /auth/refresh` with `Cookie: theme=dark; quiescent_refresh=abc123; lang=en`.
 * The goal is to extract and return `abc123`.
 * @param cookieHeader The raw `Cookie` header string from the request.
 * @returns The refresh token if found and valid, otherwise `null`.
 */
export function readRefreshCookie(cookieHeader: string | undefined): string | null {
  if (!cookieHeader) return null;

  const values = cookieHeader
    .split(";")
    .map((cookie) => cookie.trim())
    .filter((cookie) => cookie.startsWith(`${REFRESH_COOKIE_NAME}=`));

  if (values.length !== 1) return null;
  const value = values[0]?.slice(REFRESH_COOKIE_NAME.length + 1);
  return value && /^[\da-zA-Z_-]+$/.test(value) ? value : null;
}

export function getRefreshCookieOptions(environment: NodeJS.ProcessEnv = process.env) {
  return {
    httpOnly: true,
    secure: environment["NODE_ENV"] === "production",
    sameSite: "lax" as const,
    path: "/auth",
    maxAge: REFRESH_COOKIE_MAX_AGE_MS,
  };
}

export function getClearRefreshCookieOptions(environment: NodeJS.ProcessEnv = process.env) {
  return {
    httpOnly: true,
    secure: environment["NODE_ENV"] === "production",
    sameSite: "lax" as const,
    path: "/auth",
  };
}
