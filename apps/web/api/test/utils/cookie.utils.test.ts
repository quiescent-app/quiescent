import { describe, expect, it } from "vitest";

import {
  getClearRefreshCookieOptions,
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
});
