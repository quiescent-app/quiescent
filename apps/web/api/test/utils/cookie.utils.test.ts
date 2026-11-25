import { describe, expect, it } from "vitest";

import {
  EXTENSION_REFRESH_COOKIE_NAME,
  getClearExtensionRefreshCookieOptions,
  getClearRefreshCookieOptions,
  getExtensionRefreshCookieOptions,
  getExtensionRefreshCookieName,
  getRefreshCookieOptions,
  readRefreshCookie,
  REFRESH_COOKIE_MAX_AGE_MS,
} from "../../utils/cookie.utils.js";

describe("refresh cookie helpers", () => {
  it("reads one refresh cookie and rejects missing, duplicate, or malformed values", () => {
    expect(readRefreshCookie("theme=light; quiescent_refresh=abc_123-xyz")).toBe("abc_123-xyz");
    expect(readRefreshCookie(undefined)).toBeNull();
    expect(readRefreshCookie("quiescent_refresh=one; quiescent_refresh=two")).toBeNull();
    expect(readRefreshCookie("quiescent_refresh=bad%3Dvalue")).toBeNull();
  });

  it("sets a persistent host-only HttpOnly cookie with production Secure", () => {
    expect(getRefreshCookieOptions({ NODE_ENV: "production" })).toEqual({
      httpOnly: true,
      secure: true,
      sameSite: "lax",
      path: "/auth",
      maxAge: REFRESH_COOKIE_MAX_AGE_MS,
    });
    expect(getClearRefreshCookieOptions({ NODE_ENV: "production" })).toEqual({
      httpOnly: true,
      secure: true,
      sameSite: "lax",
      path: "/auth",
    });
  });

  it("keeps the extension cookie separate from the web cookie", () => {
    const extensionId = "a".repeat(32);
    const cookieName = getExtensionRefreshCookieName(extensionId);
    const header = `quiescent_refresh=web-token; ${cookieName}=extension-token`;
    expect(readRefreshCookie(header)).toBe("web-token");
    expect(cookieName).toBe(`${EXTENSION_REFRESH_COOKIE_NAME}_${extensionId}`);
    expect(readRefreshCookie(header, cookieName)).toBe("extension-token");
    expect(getExtensionRefreshCookieOptions({ NODE_ENV: "production" })).toEqual({
      httpOnly: true,
      secure: true,
      sameSite: "lax",
      path: "/auth/extension-refresh",
      maxAge: REFRESH_COOKIE_MAX_AGE_MS,
    });
    expect(getClearExtensionRefreshCookieOptions({ NODE_ENV: "production" })).toEqual({
      httpOnly: true,
      secure: true,
      sameSite: "lax",
      path: "/auth/extension-refresh",
    });
  });
});
