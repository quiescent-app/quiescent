import { beforeEach, describe, expect, it, vi } from "vitest";

const futureToken = () => `x.${btoa(JSON.stringify({ exp: Math.floor(Date.now() / 1000) + 900 }))}.x`;
const expiredToken = () => `x.${btoa(JSON.stringify({ exp: 1 }))}.x`;

let stored: Record<string, unknown>;
let fetchMock: ReturnType<typeof vi.fn>;

beforeEach(() => {
  vi.resetModules();
  vi.stubEnv("VITE_API_BASE_URL", "http://localhost:3000");
  stored = {};
  fetchMock = vi.fn();
  vi.stubGlobal("fetch", fetchMock);
  vi.stubGlobal("chrome", {
    storage: { local: {
      setAccessLevel: vi.fn().mockResolvedValue(undefined),
      get: vi.fn(async () => ({ ...stored })),
      set: vi.fn(async (values: Record<string, unknown>) => { Object.assign(stored, values); }),
      remove: vi.fn(async (key: string) => { delete stored[key]; }),
    } },
  });
});

describe("background auth session", () => {
  it("stores login tokens and restores a session", async () => {
    fetchMock.mockResolvedValue({ ok: true, json: async () => ({ accessToken: futureToken(), refreshToken: "refresh-1" }) });
    const auth = await import("../src/background/auth");
    expect(await auth.login(" reader@example.com ", "password123")).toEqual({ authenticated: true, email: "reader@example.com" });
    expect(await auth.getAuthStatus()).toEqual({ authenticated: true, email: "reader@example.com" });
    expect(stored.authSession).toMatchObject({ refreshToken: "refresh-1" });
    expect(chrome.storage.local.setAccessLevel).toHaveBeenCalledWith({ accessLevel: "TRUSTED_CONTEXTS" });
    expect(fetchMock).toHaveBeenCalledOnce();
  });

  it("refreshes an expired access token and replaces both tokens", async () => {
    stored.authSession = { accessToken: expiredToken(), refreshToken: "refresh-1", email: "reader@example.com" };
    fetchMock.mockResolvedValue({ ok: true, json: async () => ({ accessToken: futureToken(), refreshToken: "refresh-2" }) });
    const auth = await import("../src/background/auth");
    expect(await auth.getAuthStatus()).toEqual({ authenticated: true, email: "reader@example.com" });
    expect(stored.authSession).toMatchObject({ refreshToken: "refresh-2" });
    expect(fetchMock.mock.calls[0]?.[1]?.body).toBe(JSON.stringify({ refreshToken: "refresh-1" }));
  });

  it("shares one refresh request across concurrent status checks", async () => {
    stored.authSession = { accessToken: expiredToken(), refreshToken: "refresh-1", email: "reader@example.com" };
    fetchMock.mockResolvedValue({ ok: true, json: async () => ({ accessToken: futureToken(), refreshToken: "refresh-2" }) });
    const auth = await import("../src/background/auth");
    const [first, second] = await Promise.all([auth.getAuthStatus(), auth.getAuthStatus()]);
    expect(first.authenticated && second.authenticated).toBe(true);
    expect(fetchMock).toHaveBeenCalledOnce();
  });
  it("clears a rejected refresh token", async () => {
    stored.authSession = { accessToken: expiredToken(), refreshToken: "revoked", email: "reader@example.com" };
    fetchMock.mockResolvedValue({ ok: false, status: 401 });
    const auth = await import("../src/background/auth");
    await expect(auth.getAuthStatus()).rejects.toThrow("Sign in again");
    expect(stored.authSession).toBeUndefined();
  });

  it("clears local tokens on sign-out and revokes the refresh token", async () => {
    stored.authSession = { accessToken: futureToken(), refreshToken: "refresh-1", email: "reader@example.com" };
    fetchMock.mockResolvedValue({ ok: true });
    const auth = await import("../src/background/auth");
    expect(await auth.logout()).toEqual({ authenticated: false });
    expect(stored.authSession).toBeUndefined();
    expect(fetchMock.mock.calls[0]?.[1]?.body).toBe(JSON.stringify({ refreshToken: "refresh-1" }));
  });
});

