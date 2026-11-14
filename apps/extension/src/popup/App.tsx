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
type SaveState = "ready" | "saving" | "saved" | "already-saved" | "error";
type ArticleReply = { ok: boolean; result?: "saved" | "not-saved" | "already-saved"; authRequired?: boolean };

const progressUnavailableMessage =
  "Reading progress isn't available on this page. Try a regular website instead.";
const webOrigin = import.meta.env.VITE_WEB_BASE_URL || "http://localhost:5173";

function App() {
  const [sessionState, setSessionState] = useState<SessionState>("loading");
  const [saveState, setSaveState] = useState<SaveState>("ready");
  const [checkFailed, setCheckFailed] = useState(false);
  const [pageState, setPageState] = useState<PageState>("loading");
  const [article, setArticle] = useState<ArticlePreview | null>(null);
  const [pageKey, setPageKey] = useState<string | null>(null);
  const [checkedPageKey, setCheckedPageKey] = useState<string | null>(null);
  const [progressState, setProgressState] = useState<ProgressState>({ status: "idle" });
  const trackedTabId = useRef<number | null>(null);
  const trackedPageUrl = useRef<string | null>(null);
  const currentPageKey = useRef<string | null>(null);
  const requestVersion = useRef(0);
  const pageQueryVersion = useRef(0);

  const updatePage = useCallback(async () => {
    const queryVersion = ++pageQueryVersion.current;
    setPageState("loading");
    try {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      if (queryVersion !== pageQueryVersion.current) return;
      const preview = previewFromTab(tab);
      const nextPageKey = preview ? `${tab?.id ?? "unknown"}:${preview.url}` : null;
      if (nextPageKey !== currentPageKey.current) {
        currentPageKey.current = nextPageKey;
        setPageKey(nextPageKey);
        setCheckedPageKey(null);
        requestVersion.current += 1;
        setSaveState("ready");
        setCheckFailed(false);
      }
      setArticle(preview);
      setPageState(preview ? "ready" : "unsupported");
    } catch {
      if (queryVersion !== pageQueryVersion.current) return;
      currentPageKey.current = null;
      setPageKey(null);
      setCheckedPageKey(null);
      requestVersion.current += 1;
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

  const articleUrl = article?.url;
  const isChecking = sessionState === "signed-in" && !!articleUrl && checkedPageKey !== pageKey;

  useEffect(() => {
    if (!articleUrl || sessionState !== "signed-in") return;
    const checkedPageKey = pageKey;
    const version = ++requestVersion.current;
    let active = true;
    void chrome.runtime.sendMessage({ type: "CHECK_ARTICLE", url: articleUrl }).then((reply: ArticleReply) => {
      if (!active || checkedPageKey !== currentPageKey.current || version !== requestVersion.current) return;
      setCheckedPageKey(checkedPageKey);
      if (reply.authRequired) {
        setSessionState("signed-out");
        setSaveState("ready");
      } else if (reply.ok && reply.result === "saved") {
        setSaveState("already-saved");
      } else if (reply.ok && reply.result === "not-saved") {
        setSaveState("ready");
      } else {
        setSaveState("ready");
        setCheckFailed(true);
      }
    }).catch(() => {
      if (!active || checkedPageKey !== currentPageKey.current || version !== requestVersion.current) return;
      setCheckedPageKey(checkedPageKey);
      setSaveState("ready");
      setCheckFailed(true);
    });
    return () => { active = false; };
  }, [articleUrl, pageKey, sessionState]);

  const handleSave = async () => {
    if (!article || pageState !== "ready" || sessionState !== "signed-in" || isChecking || (saveState !== "ready" && saveState !== "error")) return;
    const pageKey = currentPageKey.current;
    const version = ++requestVersion.current;
    setSaveState("saving");
    setCheckFailed(false);
    try {
      const reply = await chrome.runtime.sendMessage({ type: "SAVE_ARTICLE", article: { title: article.title, url: article.url } }) as ArticleReply;
      if (pageKey !== currentPageKey.current || version !== requestVersion.current) return;
      if (reply.authRequired) {
        setSessionState("signed-out");
        setSaveState("ready");
        return;
      }
      if (!reply.ok || !reply.result) throw new Error("Save failed");
      if (reply.result !== "saved" && reply.result !== "already-saved") throw new Error("Save failed");
      setSaveState(reply.result);
    } catch {
      if (pageKey === currentPageKey.current && version === requestVersion.current) setSaveState("error");
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
            <button className="save-button" disabled={sessionState !== "signed-in" || isChecking || saveState === "saving" || saveState === "saved" || saveState === "already-saved"} onClick={() => void handleSave()} type="button">{isChecking ? "Checking..." : saveState === "saving" ? "Saving..." : saveState === "saved" ? "Saved" : saveState === "already-saved" ? "Already saved" : "Add to Quiescent"}</button>
            {checkFailed && <p className="save-hint status-error" role="status">Could not check saved status. You can still try saving.</p>}
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
