export const REFRESH_COOKIE_NAME = "quiescent_refresh";
export const EXTENSION_REFRESH_COOKIE_NAME = "quiescent_extension_refresh";
export const EXTENSION_ID_PATTERN = /^[a-p]{32}$/;
export const REFRESH_COOKIE_MAX_AGE_MS = 30 * 24 * 60 * 60 * 1000;

/**
 * Reads the refresh token from a Cookie header, for example:
 * `POST /auth/refresh` with `Cookie: theme=dark; quiescent_refresh=abc123; lang=en`.
 * The goal is to extract and return `abc123`.
 * @param cookieHeader The raw `Cookie` header string from the request.
 * @returns The refresh token if found and valid, otherwise `null`.
 */
export function readRefreshCookie(
  cookieHeader: string | undefined,
  name = REFRESH_COOKIE_NAME,
): string | null {
  if (!cookieHeader) return null;

  const values = cookieHeader
    .split(";")
    .map((cookie) => cookie.trim())
    .filter((cookie) => cookie.startsWith(`${name}=`));

  if (values.length !== 1) return null;
  const value = values[0]?.slice(name.length + 1);
  return value && /^[\da-zA-Z_-]+$/.test(value) ? value : null;
}

export function getExtensionRefreshCookieName(extensionId: string): string {
  if (!EXTENSION_ID_PATTERN.test(extensionId)) {
    throw new Error("Invalid extension ID");
  }
  return `${EXTENSION_REFRESH_COOKIE_NAME}_${extensionId}`;
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
  const { maxAge, ...options } = getRefreshCookieOptions(environment);
  void maxAge;
  return options;
}

export function getExtensionRefreshCookieOptions(environment: NodeJS.ProcessEnv = process.env) {
  return { ...getRefreshCookieOptions(environment), path: "/auth/extension-refresh" };
}

export function getClearExtensionRefreshCookieOptions(environment: NodeJS.ProcessEnv = process.env) {
  const { maxAge, ...options } = getExtensionRefreshCookieOptions(environment);
  void maxAge;
  return options;
}
