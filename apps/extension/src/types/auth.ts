export type AuthStatus = { authenticated: boolean; email?: string };

export type AuthMessage =
  | { type: "AUTH_STATUS" }
  | { type: "AUTH_LOGIN"; email: string; password: string }
  | { type: "AUTH_LOGOUT" };

export type AuthReply =
  | { ok: true; status: AuthStatus }
  | { ok: false; message: string };

export async function requestAuth(message: AuthMessage): Promise<AuthReply> {
  return chrome.runtime.sendMessage(message) as Promise<AuthReply>;
}
