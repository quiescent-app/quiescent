import { useCallback, useEffect, useRef, useState } from "react";

import type {
  ReadingProgressResponse,
  ReadingProgressUpdate,
} from "../types/readingProgress";
import { getSaveConfiguration, previewFromTab, saveArticle, type ArticlePreview } from "./article";
import "./styles.css";

type ProgressState =
  | { status: "idle" }
  | { status: "loading" }
  | { status: "tracking"; progress: number }
  | { status: "unavailable"; message: string };

export type SavePreviewState =
  | "loading"
  | "ready"
  | "saving"
  | "saved"
  | "already-saved"
  | "unsupported"
  | "unavailable"
  | "error"
  | "offline";

const previewStages: { label: string; state: SavePreviewState }[] = [
  { label: "Checking", state: "loading" },
  { label: "Ready", state: "ready" },
  { label: "Saving", state: "saving" },
  { label: "Saved", state: "saved" },
  { label: "Already saved", state: "already-saved" },
  { label: "Error", state: "error" },
  { label: "Offline", state: "offline" },
  { label: "Unsupported", state: "unsupported" },
  { label: "Unavailable", state: "unavailable" },
];

const sampleArticle: ArticlePreview = {
  title: "A sample article for preview",
  url: "https://example.com/article",
  source: "example.com",
};

const progressUnavailableMessage =
  "Reading progress isn't available on this page. Try a regular website instead.";

function SaveNotice({ title, detail, offline = false }: { title: string; detail: string; offline?: boolean }) {
  return (
    <div className="save-alert" role="status">
      <svg aria-hidden="true" className="save-alert-icon" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" viewBox="0 0 24 24">
        {offline ? (
          <>
            <path d="M3 3l18 18M5 9a12 12 0 0 1 11-2M8 12a7 7 0 0 1 7 1M11 16h2M3 12a16 16 0 0 1 2-2M17 9a16 16 0 0 1 4 3" />
          </>
        ) : (
          <>
            <circle cx="12" cy="12" r="9" />
            <path d="M12 7v6M12 17h.01" />
          </>
        )}
      </svg>
      <div>
        <h2>{title}</h2>
        <p>{detail}</p>
      </div>
    </div>
  );
}

function SavePreview({
  state,
  article,
  configured,
  previewMode,
  onSave,
}: {
  state: SavePreviewState;
  article: ArticlePreview | null;
  configured: boolean;
  previewMode: boolean;
  onSave: () => void;
}) {
  if (state === "loading") {
    return <section aria-label="Save article" className="save-preview" role="status">Checking page…</section>;
  }

  if (state === "unsupported" || state === "unavailable" || !article) {
    return (
      <section aria-label="Save article" className="save-preview">
        <SaveNotice
          title={state === "unavailable" ? "This page can’t be checked" : "Unsupported page"}
          detail={state === "unavailable" ? "Close and reopen Quiescent to try again." : "Open a regular website to save it to Quiescent."}
        />
      </section>
    );
  }

  const status = state === "saving"
    ? "Saving…"
    : state === "saved"
      ? "Saved to Read later"
      : state === "already-saved"
        ? "Already in your library"
        : null;

  return (
    <section aria-label="Save article" className="save-preview">
      {state === "error" && <SaveNotice title="Couldn’t save this article" detail="Nothing was saved. Try again." />}
      {state === "offline" && <SaveNotice title="Couldn’t save, you’re offline" detail="Nothing was saved." offline />}
      {status && (
        <p className={`save-status ${state === "saving" ? "is-saving" : ""}`} role="status">
          <span aria-hidden="true">{state === "saving" ? "◌" : "✓"}</span>
          {status}
        </p>
      )}
      {state !== "error" && state !== "offline" && <p className="preview-label">Current page</p>}
      <article className="article-card">
        <p className="article-source">{article.source}</p>
        <h2>{article.title}</h2>
        <p className="article-url" title={article.url}>{article.url}</p>
      </article>
      <button
        className="save-button"
        disabled={previewMode || !configured || state === "saving" || state === "saved" || state === "already-saved" || state === "offline"}
        onClick={onSave}
        type="button"
      >
        {state === "saving" ? "Saving…" : state === "already-saved" ? "Already saved" : state === "saved" ? "Saved" : state === "error" || state === "offline" ? "Retry" : "Add to Quiescent"}
      </button>
      {!previewMode && !configured && <p className="save-hint status-error" role="status">Set the API URL and test user ID to enable saving.</p>}
    </section>
  );
}

function App() {
  const [progressState, setProgressState] = useState<ProgressState>({ status: "idle" });
  const [saveState, setSaveState] = useState<SavePreviewState>("loading");
  const [previewState, setPreviewState] = useState<SavePreviewState | null>(null);
  const [article, setArticle] = useState<ArticlePreview | null>(null);
  const articleRef = useRef<ArticlePreview | null>(null);
  const activeTabId = useRef<number | null>(null);
  const pageRequestId = useRef(0);
  const saveRequestId = useRef(0);
  const savingRef = useRef(false);
  const trackedTabId = useRef<number | null>(null);
  const trackedPageUrl = useRef<string | null>(null);
  const configuration = getSaveConfiguration();
  const previewEnabled = import.meta.env.VITE_ENABLE_STATE_PREVIEW === "true";
  const activePreview = previewEnabled ? previewState : null;

  const updatePage = useCallback(async () => {
    const requestId = ++pageRequestId.current;
    articleRef.current = null;
    saveRequestId.current++;
    savingRef.current = false;
    try {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      if (requestId !== pageRequestId.current) return;
      activeTabId.current = tab?.id ?? null;
      const preview = previewFromTab(tab);
      articleRef.current = preview;
      setArticle(preview);
      setSaveState(preview ? "ready" : "unsupported");
    } catch {
      if (requestId !== pageRequestId.current) return;
      activeTabId.current = null;
      articleRef.current = null;
      setArticle(null);
      setSaveState("unavailable");
    }
  }, []);

  const handleSave = async () => {
    const preview = articleRef.current;
    if (!preview || !configuration || activePreview !== null || savingRef.current || saveState === "saved" || saveState === "already-saved") return;
    const requestId = ++saveRequestId.current;
    savingRef.current = true;
    setSaveState("saving");
    try {
      const [currentTab] = await chrome.tabs.query({ active: true, currentWindow: true });
      const currentPreview = previewFromTab(currentTab);
      if (requestId !== saveRequestId.current) return;
      if (currentTab?.id !== activeTabId.current || !currentPreview ||
        currentPreview.url !== preview.url || currentPreview.title !== preview.title) {
        savingRef.current = false;
        void updatePage();
        return;
      }

      const result = await saveArticle(preview, configuration);
      if (requestId === saveRequestId.current) {
        savingRef.current = false;
        setSaveState(result);
      }
    } catch {
      if (requestId === saveRequestId.current) {
        savingRef.current = false;
        setSaveState("error");
      }
    }
  };

  const handleOpenWeb = () => {
    window.open("http://localhost:5173", "_blank");
  };

  const startReadingProgress = useCallback(async () => {
    setProgressState({ status: "loading" });

    try {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

      if (tab?.id === undefined || !tab.url?.match(/^(https?|file):/)) {
        trackedTabId.current = null;
        trackedPageUrl.current = null;
        setProgressState({ status: "unavailable", message: progressUnavailableMessage });
        return;
      }

      trackedTabId.current = tab.id;
      trackedPageUrl.current = tab.url;
      const response = (await chrome.tabs.sendMessage(tab.id, {
        type: "START_READING_PROGRESS",
      })) as ReadingProgressResponse | undefined;

      if (!response?.ok || !Number.isFinite(response.progress)) {
        throw new Error("The page did not return a reading position.");
      }

      setProgressState({ status: "tracking", progress: response.progress });
    } catch {
      trackedTabId.current = null;
      trackedPageUrl.current = null;
      setProgressState({ status: "unavailable", message: progressUnavailableMessage });
    }
  }, []);

  useEffect(() => {
    const pageRequestRef = pageRequestId;
    const saveRequestRef = saveRequestId;
    void Promise.resolve().then(updatePage);

    const handleProgressUpdate = (
      message: ReadingProgressUpdate,
      sender: chrome.runtime.MessageSender,
    ) => {
      if (
        message.type === "READING_PROGRESS_UPDATE" &&
        sender.tab?.id === trackedTabId.current &&
        message.url === trackedPageUrl.current &&
        Number.isFinite(message.progress)
      ) {
        setProgressState({ status: "tracking", progress: message.progress });
      }
    };

    const handleActiveTabChanged = () => {
      setSaveState("loading");
      void updatePage();
      if (trackedTabId.current !== null) void startReadingProgress();
    };

    const handleTabUpdated = (
      tabId: number,
      changeInfo: { status?: string; url?: string; title?: string },
    ) => {
      if (tabId === activeTabId.current && (changeInfo.url || changeInfo.title || changeInfo.status === "complete")) {
        setSaveState("loading");
        void updatePage();
      }
      if (tabId !== trackedTabId.current) return;

      if (changeInfo.url) {
        trackedPageUrl.current = changeInfo.url;
        setProgressState({ status: "loading" });
      }

      if (changeInfo.status === "complete") void startReadingProgress();
    };

    chrome.runtime.onMessage.addListener(handleProgressUpdate);
    chrome.tabs.onActivated.addListener(handleActiveTabChanged);
    chrome.tabs.onUpdated.addListener(handleTabUpdated);

    return () => {
      pageRequestRef.current++;
      saveRequestRef.current++;
      chrome.runtime.onMessage.removeListener(handleProgressUpdate);
      chrome.tabs.onActivated.removeListener(handleActiveTabChanged);
      chrome.tabs.onUpdated.removeListener(handleTabUpdated);
    };
  }, [startReadingProgress, updatePage]);

  const progress = progressState.status === "tracking" ? progressState.progress : 0;

  return (
    <main className="popup-shell">
      <header className="popup-header">
        <div className="brand">
          <img alt="" aria-hidden="true" className="brand-logo" src="/quiescent-logo.png" />
          <h1>Quiescent</h1>
        </div>
        <div className="header-actions">
          <button className="app-link" onClick={handleOpenWeb} type="button">Open app</button>
          <button aria-label="Close Quiescent" className="close-button" onClick={() => window.close()} type="button">×</button>
        </div>
      </header>

      <SavePreview
        state={activePreview ?? saveState}
        article={activePreview === null ? article : article ?? sampleArticle}
        configured={configuration !== null}
        previewMode={activePreview !== null}
        onSave={() => void handleSave()}
      />

      {previewEnabled && (
        <section aria-label="Save state preview" className="state-preview">
          <h2>Preview save states</h2>
          <div className="state-preview-buttons">
            <button
              aria-pressed={activePreview === null}
              onClick={() => setPreviewState(null)}
              type="button"
            >
              Live
            </button>
            {previewStages.map(({ label, state }) => (
              <button
                aria-pressed={activePreview === state}
                key={state}
                onClick={() => setPreviewState(state)}
                type="button"
              >
                {label}
              </button>
            ))}
          </div>
        </section>
      )}

      <section aria-label="Reading progress" className="progress-section" aria-live="polite">
        <button
          className="progress-button"
          disabled={progressState.status === "loading"}
          onClick={() => void startReadingProgress()}
          type="button"
        >
          {progressState.status === "loading" ? "Checking page…" : "Reading progress"}
        </button>

        {progressState.status === "idle" && (
          <p className="status-copy">See where you are in the article.</p>
        )}
        {progressState.status === "loading" && (
          <p className="status-copy">Calculating your position…</p>
        )}
        {progressState.status === "tracking" && (
          <div className="progress-result">
            <div className="progress-value">
              <span>Reading progress</span>
              <strong>{progress}%</strong>
            </div>
            <div
              aria-label={`Reading progress: ${progress}%`}
              aria-valuemax={100}
              aria-valuemin={0}
              aria-valuenow={progress}
              className="progress-track"
              role="progressbar"
            >
              <span style={{ width: `${progress}%` }} />
            </div>
          </div>
        )}
        {progressState.status === "unavailable" && (
          <p className="status-copy status-error" role="status">{progressState.message}</p>
        )}
      </section>
    </main>
  );
}

export default App;
