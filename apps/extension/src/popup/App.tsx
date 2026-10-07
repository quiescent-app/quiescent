import { useCallback, useEffect, useRef, useState } from "react";

import type {
  ReadingProgressResponse,
  ReadingProgressUpdate,
} from "../types/readingProgress";
import "./styles.css";

type ProgressState =
  | { status: "idle" }
  | { status: "loading" }
  | { status: "tracking"; progress: number }
  | { status: "unavailable"; message: string };

const unavailableMessage =
  "Reading progress isn't available on this page. Try a regular website instead.";

function App() {
  const [progressState, setProgressState] = useState<ProgressState>({
    status: "idle",
  });
  const trackedTabId = useRef<number | null>(null);
  const trackedPageUrl = useRef<string | null>(null);

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
        setProgressState({ status: "unavailable", message: unavailableMessage });
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

      setProgressState({
        status: "tracking",
        progress: response.progress,
      });
    } catch {
      trackedTabId.current = null;
      trackedPageUrl.current = null;
      setProgressState({ status: "unavailable", message: unavailableMessage });
    }
  }, []);

  useEffect(() => {
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
        setProgressState({
          status: "tracking",
          progress: message.progress,
        });
      }
    };

    const handleActiveTabChanged = () => {
      if (trackedTabId.current !== null) {
        void startReadingProgress();
      }
    };

    const handleTabUpdated = (
      tabId: number,
      changeInfo: { status?: string; url?: string },
    ) => {
      if (tabId !== trackedTabId.current) {
        return;
      }

      if (changeInfo.url) {
        trackedPageUrl.current = changeInfo.url;
        setProgressState({ status: "loading" });
      }

      if (changeInfo.status === "complete") {
        void startReadingProgress();
      }
    };

    chrome.runtime.onMessage.addListener(handleProgressUpdate);
    chrome.tabs.onActivated.addListener(handleActiveTabChanged);
    chrome.tabs.onUpdated.addListener(handleTabUpdated);

    return () => {
      chrome.runtime.onMessage.removeListener(handleProgressUpdate);
      chrome.tabs.onActivated.removeListener(handleActiveTabChanged);
      chrome.tabs.onUpdated.removeListener(handleTabUpdated);
    };
  }, [startReadingProgress]);

  const progress =
    progressState.status === "tracking" ? progressState.progress : 0;

  return (
    <main className="popup-shell">
      <header className="popup-header">
        <div>
          <h1>Quiescent</h1>
          <p>Stay oriented while you read.</p>
        </div>
        <button className="app-link" onClick={handleOpenWeb} type="button">
          Open app
        </button>
      </header>

      <section className="progress-section" aria-live="polite">
        <button
          className="progress-button"
          disabled={progressState.status === "loading"}
          onClick={() => void startReadingProgress()}
          type="button"
        >
          {progressState.status === "loading"
            ? "Checking page…"
            : "Reading progress"}
        </button>

        {progressState.status === "idle" && (
          <p className="status-copy">
            Press the button to see your reading progress.
          </p>
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
          <p className="status-copy status-error" role="status">
            {progressState.message}
          </p>
        )}
      </section>
    </main>
  );
}

export default App;
