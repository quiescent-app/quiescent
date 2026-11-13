import type { AuthStatus } from "../types/auth";

type Session = {
  accessToken: string;
  refreshToken: string;
  email: string;
};

const SESSION_KEY = "authSession";
const REFRESH_BUFFER_SECONDS = 60;
let refreshPromise: Promise<Session> | null = null;
const generation = 0;
let storageReady: Promise<void> | null = null;

export class SessionExpiredError extends Error {}

function apiOrigin(): string {
  const configured = import.meta.env.VITE_API_BASE_URL?.trim();
  if (!configured) throw new Error("API URL is not configured.");
  const url = new URL(configured);
  if (!["http:", "https:"].includes(url.protocol) || url.pathname !== "/" || url.search || url.hash) {
    throw new Error("API URL must be an HTTP(S) origin.");
  }
  return url.origin;
}

function ready(): Promise<void> {
  storageReady ??= chrome.storage.local.setAccessLevel({ accessLevel: "TRUSTED_CONTEXTS" });
  return storageReady;
}

async function readSession(): Promise<Session | null> {
  await ready();
  const result = await chrome.storage.local.get(SESSION_KEY);
  const value = result[SESSION_KEY] as Partial<Session> | undefined;
  if (!value || typeof value.accessToken !== "string" ||
    typeof value.refreshToken !== "string" || typeof value.email !== "string") return null;
  return value as Session;
}

async function writeSession(session: Session | null): Promise<void> {
  await ready();
  if (session) await chrome.storage.local.set({ [SESSION_KEY]: session });
  else await chrome.storage.local.remove(SESSION_KEY);
}

function expiresSoon(token: string): boolean {
  try {
    const payload = JSON.parse(atob((token.split(".")[1] ?? "").replace(/-/g, "+").replace(/_/g, "/"))) as { exp?: number };
    return typeof payload.exp !== "number" || payload.exp <= Date.now() / 1000 + REFRESH_BUFFER_SECONDS;
  } catch {
    return true;
  }
}

async function errorMessage(response: Response): Promise<string> {
  const body = await response.json().catch(() => null) as { error?: { message?: string } } | null;
  return body?.error?.message || `Request failed (${response.status}).`;
}

function parseTokens(body: unknown, email: string): Session {
  const result = body as { accessToken?: unknown; refreshToken?: unknown };
  if (typeof result?.accessToken !== "string" || typeof result?.refreshToken !== "string") {
    throw new Error("Invalid authentication response.");
  }
  return { accessToken: result.accessToken, refreshToken: result.refreshToken, email };
}

async function refresh(session: Session): Promise<Session> {
  if (refreshPromise) return refreshPromise;
  const version = generation;
  refreshPromise = (async () => {
    const response = await fetch(new URL("/auth/refresh", apiOrigin()), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ refreshToken: session.refreshToken }),
    });
    if (response.status === 401) {
      if (version === generation) await writeSession(null);
      throw new SessionExpiredError("Your session expired. Sign in again.");
    }
    if (!response.ok) throw new Error(await errorMessage(response));
    const updated = parseTokens(await response.json(), session.email);
    if (version !== generation) throw new Error("Session changed. Try again.");
    await writeSession(updated);
    return updated;
  })();
  try {
    return await refreshPromise;
  } finally {
    refreshPromise = null;
  }
}

export async function getAuthStatus(): Promise<AuthStatus> {
  const session = await readSession();
  if (!session) return { authenticated: false };
  if (expiresSoon(session.accessToken)) {
    await refresh(session);
    const current = await readSession();
    if (!current) return { authenticated: false };
    return { authenticated: true, email: current.email };
  }
  return { authenticated: true, email: session.email };
}

export async function acceptSession(input: unknown): Promise<AuthStatus> {
  const value = input as { accessToken?: unknown; refreshToken?: unknown; user?: { email?: unknown } };
  if (typeof value?.accessToken !== "string" || typeof value.refreshToken !== "string" || typeof value.user?.email !== "string") {
    throw new Error("Invalid session handoff.");
  }
  await writeSession({ accessToken: value.accessToken, refreshToken: value.refreshToken, email: value.user.email });
  return { authenticated: true, email: value.user.email };
}

async function articleRequest(method: "GET" | "POST", url: string, article?: { title: string; url: string }): Promise<Response> {
  let session = await readSession();
  if (!session) throw new SessionExpiredError("Sign in to save articles.");
  if (expiresSoon(session.accessToken)) session = await refresh(session);
  const endpoint = new URL(method === "GET" ? "/articles/by-url" : "/articles", apiOrigin());
  if (method === "GET") endpoint.searchParams.set("url", url);
  const send = (accessToken: string) => fetch(endpoint, {
    method,
    headers: { Authorization: `Bearer ${accessToken}`, ...(article ? { "Content-Type": "application/json" } : {}) },
    ...(article ? { body: JSON.stringify(article) } : {}),
  });
  const response = await send(session.accessToken);
  if (response.status === 401) {
    session = await refresh(session);
    const retry = await send(session.accessToken);
    if (retry.status === 401) throw new SessionExpiredError("Your session expired. Sign in again.");
    return retry;
  }
  return response;
}

export async function checkArticle(url: string): Promise<"saved" | "not-saved"> {
  const response = await articleRequest("GET", url);
  if (response.status === 404) return "not-saved";
  if (!response.ok) throw new Error(await errorMessage(response));
  return "saved";
}

export async function saveArticle(article: { title: string; url: string }): Promise<"saved" | "already-saved"> {
  const response = await articleRequest("POST", article.url, article);
  if (response.status === 409) return "already-saved";
  if (!response.ok) throw new Error(await errorMessage(response));
  return "saved";
}
