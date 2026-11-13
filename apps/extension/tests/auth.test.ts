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
    await auth.acceptSession({ accessToken: token, refreshToken: "extension-refresh", user: { email: "reader@example.com" } });
    expect(await auth.getAuthStatus()).toEqual({ authenticated: true, email: "reader@example.com" });
    fetchMock.mockResolvedValue({ ok: true, status: 201 });
    expect(await auth.saveArticle({ title: "Story", url: "https://example.com/story" })).toBe("saved");
    expect(fetchMock.mock.calls[0]?.[1]?.headers.Authorization).toBe(`Bearer ${token}`);
    expect(fetchMock.mock.calls[0]?.[1]?.body).toBe(JSON.stringify({ title: "Story", url: "https://example.com/story" }));
  });

  it("rejects malformed handoff data", async () => {
    const auth = await import("../src/background/auth");
    await expect(auth.acceptSession({ accessToken: token })).rejects.toThrow("Invalid session handoff");
  });
});
