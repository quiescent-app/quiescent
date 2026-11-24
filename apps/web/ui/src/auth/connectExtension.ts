import { apiUrl } from "@/api/http";
import { refreshSession } from "@/service/auth.service";
import { accessToken } from "./tokenStore";

type ExtensionRuntime = {
  sendMessage: (
    extensionId: string,
    message: unknown,
    callback: (reply: { ok?: boolean }) => void,
  ) => void;
  lastError?: { message: string };
};

type ExtensionTokens = {
  accessToken: string;
  user: { email: string };
};

export async function connectExtension(extensionId: string): Promise<void> {
  if (!/^[a-p]{32}$/.test(extensionId)) {
    throw new Error("Invalid extension ID.");
  }

  const chromeRuntime = (window as Window & {
    chrome?: { runtime?: ExtensionRuntime };
  }).chrome?.runtime;

  if (!chromeRuntime?.sendMessage) {
    throw new Error("Open this page in Chrome with Quiescent installed.");
  }

  const exchange = (token: string) => fetch(apiUrl("auth/extension-session"), {
    method: "POST",
    credentials: "include",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify({ extensionId }),
  });
  let token = accessToken;
  if (!token) {
    token = (await refreshSession())?.accessToken ?? null;
  }
  if (!token) {
    throw new Error("Sign in first.");
  }

  let response = await exchange(token);
  if (response.status === 401) {
    const renewed = await refreshSession();
    if (!renewed) {
      throw new Error("Your session expired. Sign in again.");
    }
    response = await exchange(renewed.accessToken);
  }
  if (!response.ok) {
    throw new Error("Could not connect the extension. Try again.");
  }

  const tokens = await response.json() as ExtensionTokens;
  await new Promise<void>((resolve, reject) => {
    chromeRuntime.sendMessage(extensionId, { type: "EXTENSION_SESSION", tokens }, (reply) => {
      if (chromeRuntime.lastError || !reply?.ok) {
        reject(new Error("Could not connect the extension."));
      } else {
        resolve();
      }
    });
  });
}
