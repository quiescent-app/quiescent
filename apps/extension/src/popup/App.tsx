import { useCallback, useEffect, useRef, useState } from "react";

import type { ReadingProgressResponse, ReadingProgressUpdate } from "../types/readingProgress";
import { previewFromTab, type ArticlePreview } from "./article";
import "./styles.css";

type ProgressState =
  | { status: "idle" }
  | { status: "loading" }
  | { status: "tracking"; progress: number }
  | { status: "unavailable"; message: string };

type PageState = "loading" | "ready" | "unsupported" | "unavailable";
type SessionState = "loading" | "signed-out" | "signed-in";

const progressUnavailableMessage =
  "Reading progress isn't available on this page. Try a regular website instead.";
const webOrigin = import.meta.env.VITE_WEB_BASE_URL || "http://localhost:5173";

function App() {
  const [sessionState, setSessionState] = useState<SessionState>("loading");
  const [saveState, setSaveState] = useState<"ready" | "saving" | "saved" | "already-saved" | "error">("ready");
  const [pageState, setPageState] = useState<PageState>("loading");
  const [article, setArticle] = useState<ArticlePreview | null>(null);
  const [progressState, setProgressState] = useState<ProgressState>({ status: "idle" });
  const activeArticleUrl = useRef<string | null>(null);
  const savingArticleUrl = useRef<string | null>(null);
  const completedSaves = useRef(new Map<string, "saved" | "already-saved">());
  const pageRequestId = useRef(0);
  const trackedTabId = useRef<number | null>(null);
  const trackedPageUrl = useRef<string | null>(null);

  const updatePage = useCallback(async () => {
    const requestId = ++pageRequestId.current;
    setPageState("loading");
    try {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      if (requestId !== pageRequestId.current) return;
      const preview = previewFromTab(tab);
      activeArticleUrl.current = preview?.url ?? null;
      setArticle(preview);
      setSaveState(savingArticleUrl.current ? "saving" : preview ? completedSaves.current.get(preview.url) ?? "ready" : "ready");
      setPageState(preview ? "ready" : "unsupported");
    } catch {
      if (requestId !== pageRequestId.current) return;
      activeArticleUrl.current = null;
      setArticle(null);
      setPageState("unavailable");
    }
  }, []);
  const startReadingProgress = useCallback(async () => {
    setProgressState({ status: "loading" });
    try {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      if (tab?.id === undefined || !tab.url?.match(/^(https?|file):/)) throw new Error();
      trackedTabId.current = tab.id;
      trackedPageUrl.current = tab.url;
      const response = await chrome.tabs.sendMessage(tab.id, { type: "START_READING_PROGRESS" }) as ReadingProgressResponse | undefined;
      if (!response?.ok || !Number.isFinite(response.progress)) throw new Error();
      setProgressState({ status: "tracking", progress: response.progress });
    } catch {
      trackedTabId.current = null;
      trackedPageUrl.current = null;
      setProgressState({ status: "unavailable", message: progressUnavailableMessage });
    }
  }, []);

  useEffect(() => {
    let active = true;
    void chrome.runtime.sendMessage({ type: "AUTH_STATUS" }).then((reply: { ok: boolean; result?: { authenticated: boolean } }) => {
      if (active) setSessionState(reply.ok && reply.result?.authenticated ? "signed-in" : "signed-out");
    }).catch(() => { if (active) setSessionState("signed-out"); });    void Promise.resolve().then(updatePage);
    const onTabChange = () => {
      trackedTabId.current = null;
      trackedPageUrl.current = null;
      setProgressState({ status: "idle" });
      void updatePage();
    };

    const onTabUpdated = (tabId: number, changeInfo: { url?: string; title?: string; status?: string }) => {
      if (changeInfo.url || changeInfo.title || changeInfo.status === "complete") void updatePage();
      if (tabId !== trackedTabId.current) return;
      if (changeInfo.url) {
        trackedPageUrl.current = changeInfo.url;
        setProgressState({ status: "loading" });
      }
      if (changeInfo.status === "complete") void startReadingProgress();
    };

    chrome.tabs.onActivated.addListener(onTabChange);
    chrome.tabs.onUpdated.addListener(onTabUpdated);
    return () => {
      active = false;
      chrome.tabs.onActivated.removeListener(onTabChange);
      chrome.tabs.onUpdated.removeListener(onTabUpdated);
    };
  }, [updatePage, startReadingProgress]);

  const handleSave = async () => {
    if (!article || sessionState !== "signed-in" || savingArticleUrl.current || saveState === "saved" || saveState === "already-saved") return;
    const targetUrl = article.url;
    savingArticleUrl.current = targetUrl;
    setSaveState("saving");
    try {
      const reply = await chrome.runtime.sendMessage({ type: "SAVE_ARTICLE", article: { title: article.title, url: targetUrl } }) as { ok: boolean; result?: "saved" | "already-saved" };
      if (!reply.ok || !reply.result) throw new Error("Save failed");
      completedSaves.current.set(targetUrl, reply.result);
      savingArticleUrl.current = null;
      if (activeArticleUrl.current === targetUrl) setSaveState(reply.result);
      else setSaveState(activeArticleUrl.current ? completedSaves.current.get(activeArticleUrl.current) ?? "ready" : "ready");
    } catch {
      savingArticleUrl.current = null;
      setSaveState(activeArticleUrl.current === targetUrl ? "error" : activeArticleUrl.current ? completedSaves.current.get(activeArticleUrl.current) ?? "ready" : "ready");
    }
  };
  useEffect(() => {
    const listener = (message: ReadingProgressUpdate, sender: chrome.runtime.MessageSender) => {
      if (message.type === "READING_PROGRESS_UPDATE" && sender.tab?.id === trackedTabId.current && message.url === trackedPageUrl.current && Number.isFinite(message.progress)) {
        setProgressState({ status: "tracking", progress: message.progress });
      }
    };
    chrome.runtime.onMessage.addListener(listener);
    return () => chrome.runtime.onMessage.removeListener(listener);
  }, []);

  return (
    <main className="popup-shell">
      <header className="popup-header">
        <div className="brand">
          <img alt="" aria-hidden="true" className="brand-logo" src="/quiescent-logo.png" />
          <h1>Quiescent</h1>
        </div>
        <div className="header-actions">
          <button className="app-link" onClick={() => window.open(webOrigin, "_blank")} type="button">Open app</button>
          <button aria-label="Close Quiescent" className="close-button" onClick={() => window.close()} type="button">×</button>
        </div>
      </header>

      {sessionState === "loading" && <p role="status">Checking sign in...</p>}
      {sessionState === "signed-out" && <button className="save-button" onClick={() => window.open(`${webOrigin}/login?extensionId=${chrome.runtime.id}`, "_blank")} type="button">Sign in through the app</button>}
      {sessionState === "signed-in" && <p role="status">Connected to your account</p>}
      <section aria-label="Save article" className="save-preview">
        {pageState === "loading" && <p role="status">Checking page…</p>}
        {pageState === "unsupported" && <p role="status">Open a regular website to save it to Quiescent.</p>}
        {pageState === "unavailable" && <p role="status">This page can't be checked. Reopen Quiescent to try again.</p>}
        {pageState === "ready" && article && (
          <>
            <p className="preview-label">Current page</p>
            <article className="article-card">
              <p className="article-source">{article.source}</p>
              <h2>{article.title}</h2>
              <p className="article-url" title={article.url}>{article.url}</p>
            </article>
            <button className="save-button"
                    disabled={sessionState !== "signed-in" || saveState === "saving" || saveState === "saved" || saveState === "already-saved"}
                    onClick={() => void handleSave()}
                    type="button">{saveState === "saving" ? "Saving..." : saveState === "saved" ? "Saved" : saveState === "already-saved" ? "Already saved" : "Add to Quiescent"}
            </button>
            {saveState === "error" && <p className="save-hint status-error" role="alert">Could not save. Try again.</p>}
          </>
        )}
      </section>

      <section aria-label="Reading progress" className="progress-section" aria-live="polite">
        <button className="progress-button" disabled={progressState.status === "loading"} onClick={() => void startReadingProgress()} type="button">
          {progressState.status === "loading" ? "Checking page…" : "Reading progress"}
        </button>
        {progressState.status === "idle" && <p className="status-copy">See where you are in the article.</p>}
        {progressState.status === "loading" && <p className="status-copy">Calculating your position…</p>}
        {progressState.status === "unavailable" && <p className="status-copy status-error" role="status">{progressState.message}</p>}
        {progressState.status === "tracking" && (
          <div className="progress-result">
            <div className="progress-value"><span>Reading progress</span><strong>{progressState.progress}%</strong></div>
            <div aria-label={`Reading progress: ${progressState.progress}%`} aria-valuemax={100} aria-valuemin={0} aria-valuenow={progressState.progress} className="progress-track" role="progressbar">
              <span style={{ width: `${progressState.progress}%` }} />
            </div>
          </div>
        )}
      </section>
    </main>
  );
}

export default App;
