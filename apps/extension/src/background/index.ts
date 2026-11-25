import { acceptSession, checkArticle, getAuthStatus, saveArticle, SessionExpiredError } from "./auth";

chrome.runtime.onInstalled.addListener(() => console.log("Quiescent installed"));

chrome.runtime.onMessageExternal.addListener((message: { type?: string; tokens?: unknown }, sender, sendResponse) => {
  const allowed = import.meta.env.VITE_WEB_BASE_URL || "http://localhost:5173";
  if (sender.url && new URL(sender.url).origin === new URL(allowed).origin && message?.type === "EXTENSION_SESSION") {
    void acceptSession(message.tokens).then(
      () => sendResponse({ ok: true }),
      () => sendResponse({ ok: false }),
    );
    return true;
  }
});

chrome.runtime.onMessage.addListener((message: { type?: string; article?: { title: string; url: string }; url?: string }, sender, sendResponse) => {
  if (sender.url !== chrome.runtime.getURL("popup.html")) return;
  const operation = message?.type === "AUTH_STATUS" ? getAuthStatus()
    : message?.type === "SAVE_ARTICLE" && message.article ? saveArticle(message.article)
    : message?.type === "CHECK_ARTICLE" && typeof message.url === "string" ? checkArticle(message.url) : null;
  if (!operation) return;
  void operation.then(
    (result) => sendResponse({ ok: true, result }),
    (cause: unknown) => sendResponse({ ok: false, message: cause instanceof Error ? cause.message : "Request failed.", authRequired: cause instanceof SessionExpiredError }),
  );
  return true;
});
