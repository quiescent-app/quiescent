export async function connectExtension(extensionId: string): Promise<void> {
  if (!/^[a-p]{32}$/.test(extensionId)) throw new Error("Invalid extension ID.");
  const chromeRuntime = (window as Window & { chrome?: { runtime?: { sendMessage: (id: string, message: unknown, callback: (reply: { ok?: boolean }) => void) => void; lastError?: { message: string } } } }).chrome?.runtime;
  if (!chromeRuntime?.sendMessage) throw new Error("Open this page in Chrome with Quiescent installed.");
  const raw = localStorage.getItem("quiescent.auth");
  if (!raw) throw new Error("Sign in first.");
  const session = JSON.parse(raw) as { accessToken: string; refreshToken: string; user: { email: string } };
  const api = import.meta.env.VITE_API_BASE_URL || "http://localhost:3000";
  const exchange = (accessToken: string) => fetch(new URL("/auth/extension-session", api), {
    method: "POST", headers: { Authorization: `Bearer ${accessToken}` },
  });
  let response = await exchange(session.accessToken);
  if (response.status === 401) {
    const renewed = await fetch(new URL("/auth/refresh", api), {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ refreshToken: session.refreshToken }),
    });
    if (!renewed.ok) throw new Error("Your session expired. Sign in again.");
    const next = await renewed.json() as typeof session;
    localStorage.setItem("quiescent.auth", JSON.stringify(next));
    response = await exchange(next.accessToken);
  }
  if (!response.ok) throw new Error("Could not connect the extension. Sign in again.");
  const tokens = await response.json() as { accessToken: string; refreshToken: string; user: { email: string } };
  await new Promise<void>((resolve, reject) => chromeRuntime.sendMessage(extensionId, { type: "EXTENSION_SESSION", tokens }, (reply) => {
    if (chromeRuntime.lastError || !reply?.ok) reject(new Error("Could not connect the extension."));
    else resolve();
  }));
}
