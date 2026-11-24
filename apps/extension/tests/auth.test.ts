import { beforeEach, describe, expect, it, vi } from "vitest";

let stored: Record<string, unknown>;
const fetchMock = vi.fn();
const token = `x.${btoa(JSON.stringify({ exp: Math.floor(Date.now() / 1000) + 900 }))}.x`;

beforeEach(() => {
  vi.resetModules();
  vi.stubEnv("VITE_API_BASE_URL", "http://localhost:3000");
  stored = {};
  fetchMock.mockReset();
  vi.stubGlobal("fetch", fetchMock);
  vi.stubGlobal("chrome", { storage: { local: {
    setAccessLevel: vi.fn().mockResolvedValue(undefined),
    get: vi.fn(async () => ({ ...stored })),
    set: vi.fn(async (value: Record<string, unknown>) => { Object.assign(stored, value); }),
    remove: vi.fn(async (key: string) => { delete stored[key]; }),
  } } });
});

describe("extension handoff", () => {
  it("accepts a separate session and saves with its access token", async () => {
    const auth = await import("../src/background/auth");
    await auth.acceptSession({ accessToken: token, user: { email: "reader@example.com" } });
    expect(await auth.getAuthStatus()).toEqual({ authenticated: true, email: "reader@example.com" });
    expect(stored.authSession).toEqual({ accessToken: token, email: "reader@example.com" });
    fetchMock.mockResolvedValue({ ok: true, status: 201 });
    expect(await auth.saveArticle({ title: "Story", url: "https://example.com/story" })).toBe("saved");
    expect(fetchMock.mock.calls[0]?.[1]?.headers.Authorization).toBe(`Bearer ${token}`);
    expect(fetchMock.mock.calls[0]?.[1]?.body).toBe(JSON.stringify({ title: "Story", url: "https://example.com/story" }));
  });

  it("rejects malformed handoff data", async () => {
    const auth = await import("../src/background/auth");
    await expect(auth.acceptSession({ accessToken: token })).rejects.toThrow("Invalid session handoff");
  });

  it("checks saved status using the authenticated by-url endpoint", async () => {
    const auth = await import("../src/background/auth");
    await auth.acceptSession({ accessToken: token, user: { email: "reader@example.com" } });
    fetchMock.mockResolvedValueOnce({ ok: false, status: 404 }).mockResolvedValueOnce({ ok: true, status: 200 });
    expect(await auth.checkArticle("https://example.com/story#section")).toBe("not-saved");
    expect(await auth.checkArticle("https://example.com/story")).toBe("saved");
    const endpoint = fetchMock.mock.calls[0]?.[0] as URL;
    expect(endpoint.pathname).toBe("/articles/by-url");
    expect(endpoint.searchParams.get("url")).toBe("https://example.com/story#section");
    expect(fetchMock.mock.calls[0]?.[1]?.headers.Authorization).toBe(`Bearer ${token}`);
  });

  it("treats a duplicate create response as already saved", async () => {
    const auth = await import("../src/background/auth");
    await auth.acceptSession({ accessToken: token, user: { email: "reader@example.com" } });
    fetchMock.mockResolvedValue({ ok: false, status: 409 });
    expect(await auth.saveArticle({ title: "Story", url: "https://example.com/story" })).toBe("already-saved");
  });

  it("requires sign in when no session is available", async () => {
    const auth = await import("../src/background/auth");
    await expect(auth.checkArticle("https://example.com/story")).rejects.toBeInstanceOf(auth.SessionExpiredError);
  });

  it("refreshes an expired access token using only the extension cookie", async () => {
    const auth = await import("../src/background/auth");
    const expired = `x.${btoa(JSON.stringify({ exp: 1 }))}.x`;
    await auth.acceptSession({ accessToken: expired, user: { email: "reader@example.com" } });
    fetchMock.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({ accessToken: token, user: { email: "reader@example.com" } }),
    }).mockResolvedValueOnce({ ok: true, status: 201 });

    expect(await auth.saveArticle({ title: "Story", url: "https://example.com/story" })).toBe("saved");

    expect((fetchMock.mock.calls[0]?.[0] as URL).pathname).toBe("/auth/extension-refresh");
    expect(fetchMock.mock.calls[0]?.[1]).toEqual({ method: "POST", credentials: "include" });
    expect(stored.authSession).toEqual({ accessToken: token, email: "reader@example.com" });
    expect(fetchMock.mock.calls[1]?.[1]?.headers.Authorization).toBe(`Bearer ${token}`);
  });

  it("clears an expired extension session when its cookie is rejected", async () => {
    const auth = await import("../src/background/auth");
    const expired = `x.${btoa(JSON.stringify({ exp: 1 }))}.x`;
    await auth.acceptSession({ accessToken: expired, user: { email: "reader@example.com" } });
    fetchMock.mockResolvedValue({ ok: false, status: 401 });

    await expect(auth.getAuthStatus()).rejects.toBeInstanceOf(auth.SessionExpiredError);
    expect(stored.authSession).toBeUndefined();
  });

  it("removes a legacy refresh token from extension storage", async () => {
    stored.authSession = { accessToken: token, refreshToken: "legacy-token", email: "reader@example.com" };
    const auth = await import("../src/background/auth");

    expect(await auth.getAuthStatus()).toEqual({ authenticated: true, email: "reader@example.com" });
    expect(stored.authSession).toEqual({ accessToken: token, email: "reader@example.com" });
  });
});
