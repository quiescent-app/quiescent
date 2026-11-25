import { afterEach, describe, expect, it, vi } from "vitest";

import { connectExtension } from "../src/auth/connectExtension";
import { clearAccessToken, setAccessToken } from "../src/auth/tokenStore";

const extensionId = "a".repeat(32);
const tokens = { accessToken: "extension-access", user: { email: "reader@example.com" } };

afterEach(() => {
  clearAccessToken();
  localStorage.clear();
  vi.unstubAllGlobals();
  Reflect.deleteProperty(window, "chrome");
});

describe("connectExtension", () => {
  it("exchanges the web access token and sends separate tokens to the extension", async () => {
    setAccessToken("web-access");
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, status: 200, json: async () => tokens });
    vi.stubGlobal("fetch", fetchMock);
    const sendMessage = vi.fn((_id, _message, callback: (reply: { ok: boolean }) => void) => callback({ ok: true }));
    Object.assign(window, { chrome: { runtime: { sendMessage } } });

    await connectExtension(extensionId);

    expect(fetchMock).toHaveBeenCalledWith("http://localhost:3000/auth/extension-session", {
      method: "POST",
      credentials: "include",
      headers: { Authorization: "Bearer web-access", "Content-Type": "application/json" },
      body: JSON.stringify({ extensionId }),
    });
    expect(sendMessage).toHaveBeenCalledWith(extensionId, { type: "EXTENSION_SESSION", tokens }, expect.any(Function));
    expect(localStorage.getItem("quiescent.auth")).toBeNull();
  });
});
