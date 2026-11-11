import { getAuthStatus, login, logout } from "./auth";
import type { AuthMessage, AuthReply } from "../types/auth";

chrome.runtime.onInstalled.addListener(() => {
  console.log("Quiescent installed");
});

chrome.runtime.onMessage.addListener((message: AuthMessage, sender, sendResponse: (reply: AuthReply) => void) => {
  if (!message?.type?.startsWith("AUTH_") || sender.url !== chrome.runtime.getURL("popup.html")) return;

  const action = message.type === "AUTH_STATUS"
    ? getAuthStatus()
    : message.type === "AUTH_LOGIN"
      ? login(message.email, message.password)
      : message.type === "AUTH_LOGOUT"
        ? logout()
        : null;
  if (!action) return;

  void action.then(
    (status) => sendResponse({ ok: true, status }),
    (error: unknown) => sendResponse({
      ok: false,
      message: error instanceof Error ? error.message : "Authentication failed.",
    }),
  );
  return true;
});
