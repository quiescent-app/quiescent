import { afterEach, describe, expect, it, vi } from "vitest";

import { apiRequest } from "../src/api/apiClient";
import { clearAccessToken, setAccessToken } from "../src/auth/tokenStore";
import { subscribeToAuthLoss } from "../src/auth/authEvents";
import { login, refreshSession } from "../src/service/auth.service";

const firstSession = {
  user: {
    id: "user-1",
    email: "reader@example.com",
    displayName: null,
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
  },
  accessToken: "access-one",
};

const secondSession = { ...firstSession, accessToken: "access-two" };

function response(body: unknown, status = 200): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
  } as Response;
}

afterEach(() => {
  clearAccessToken();
  vi.unstubAllGlobals();
  localStorage.clear();
  sessionStorage.clear();
});

describe("web auth API client", () => {
  it("sends login credentials, stores the access token, and uses it for API requests", async () => {
    const fetchMock = vi.fn().mockResolvedValue(response(firstSession));
    vi.stubGlobal("fetch", fetchMock);

    await login({ email: "reader@example.com", password: "correct-password" });

    expect(fetchMock).toHaveBeenCalledWith(
      "http://localhost:3000/auth/login",
      expect.objectContaining({
        method: "POST",
        credentials: "include",
        body: JSON.stringify({ email: "reader@example.com", password: "correct-password" }),
      }),
    );
    expect(localStorage.getItem("quiescent_access_token")).toBe("access-one");
    expect(localStorage.getItem("quiescent_refresh_token")).toBeNull();
    expect(sessionStorage.length).toBe(0);

    fetchMock.mockResolvedValueOnce(response({ id: "profile-1" }));
    await apiRequest("users/me");
    expect(new Headers(fetchMock.mock.calls[1]?.[1]?.headers).get("Authorization"))
      .toBe("Bearer access-one");
  });

  it("signs up with credentials and stores the returned access token", async () => {
    const fetchMock = vi.fn().mockResolvedValue(response(firstSession));
    vi.stubGlobal("fetch", fetchMock);

    const { signUp } = await import("../src/service/auth.service");
    await signUp({ email: "reader@example.com", password: "correct-password" });

    expect(fetchMock).toHaveBeenCalledWith(
      "http://localhost:3000/auth/sign-up",
      expect.objectContaining({
        method: "POST",
        credentials: "include",
        body: JSON.stringify({ email: "reader@example.com", password: "correct-password" }),
      }),
    );
    expect(localStorage.getItem("quiescent_access_token")).toBe("access-one");
  });

  it("restores with the HttpOnly cookie and sends no refresh-token body", async () => {
    const fetchMock = vi.fn().mockResolvedValue(response(firstSession));
    vi.stubGlobal("fetch", fetchMock);

    await expect(refreshSession()).resolves.toEqual(firstSession);
    expect(fetchMock).toHaveBeenCalledWith("http://localhost:3000/auth/refresh", {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
    });
  });

  it("sends logout with cookies and clears the saved access token if the request fails", async () => {
    const fetchMock = vi.fn().mockRejectedValue(new Error("network failure"));
    vi.stubGlobal("fetch", fetchMock);
    const { logout } = await import("../src/service/auth.service");
    setAccessToken("access-one");

    await expect(logout()).rejects.toThrow("network failure");

    expect(fetchMock).toHaveBeenCalledWith("http://localhost:3000/auth/logout", {
      method: "POST",
      credentials: "include",
    });
    expect(localStorage.getItem("quiescent_access_token")).toBeNull();
  });

  it("shares one refresh across concurrent 401 responses and retries each request once", async () => {
    let refreshCalls = 0;
    const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      if (url.endsWith("/auth/login")) return response(firstSession);
      if (url.endsWith("/auth/refresh")) {
        refreshCalls++;
        await Promise.resolve();
        return response(secondSession);
      }
      if (new Headers(init?.headers).get("Authorization") === "Bearer access-one") {
        return response({ error: { message: "expired" } }, 401);
      }
      return response({ ok: true });
    });
    vi.stubGlobal("fetch", fetchMock);
    await login({ email: "reader@example.com", password: "correct-password" });

    await expect(Promise.all([
      apiRequest("articles"),
      apiRequest("users/me"),
    ])).resolves.toEqual([{ ok: true }, { ok: true }]);
    expect(refreshCalls).toBe(1);
    // 1 login, 2 articles and profile requests, 1 refresh, 2 retries = 6 total calls
    expect(fetchMock).toHaveBeenCalledTimes(6);
  });

  it("clears access state and announces auth loss after refresh fails", async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(response(firstSession))
      .mockResolvedValueOnce(response({ error: { message: "expired" } }, 401))
      .mockResolvedValueOnce(response({ error: { message: "expired" } }, 401));
    vi.stubGlobal("fetch", fetchMock);
    await login({ email: "reader@example.com", password: "correct-password" });
    const onAuthLost = vi.fn();
    const unsubscribe = subscribeToAuthLoss(onAuthLost);

    await expect(apiRequest("users/me")).rejects.toThrow("Your session has expired");
    expect(onAuthLost).toHaveBeenCalledOnce();
    unsubscribe();
  });
});
