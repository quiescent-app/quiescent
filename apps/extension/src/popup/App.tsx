import { useCallback, useEffect, useRef, useState, type FormEvent } from "react";

import type { ReadingProgressResponse, ReadingProgressUpdate } from "../types/readingProgress";
import { requestAuth, type AuthStatus } from "../types/auth";
import { previewFromTab, type ArticlePreview } from "./article";
import "./styles.css";

type ProgressState =
  | { status: "idle" }
  | { status: "loading" }
  | { status: "tracking"; progress: number }
  | { status: "unavailable"; message: string };

type PageState = "loading" | "ready" | "unsupported" | "unavailable";
type SessionState = "loading" | "signed-out" | "signed-in";
type AuthView = "login" | "signup";

const progressUnavailableMessage =
  "Reading progress isn't available on this page. Try a regular website instead.";
const webOrigin = import.meta.env.VITE_WEB_BASE_URL || "http://localhost:5173";

function App() {
  const [sessionState, setSessionState] = useState<SessionState>("loading");
  const [session, setSession] = useState<AuthStatus>({ authenticated: false });
  const [authView, setAuthView] = useState<AuthView>("login");
  const [authError, setAuthError] = useState("");
  const [authBusy, setAuthBusy] = useState(false);
  const [pageState, setPageState] = useState<PageState>("loading");
  const [article, setArticle] = useState<ArticlePreview | null>(null);
  const [progressState, setProgressState] = useState<ProgressState>({ status: "idle" });
  const trackedTabId = useRef<number | null>(null);
  const trackedPageUrl = useRef<string | null>(null);

  const updatePage = useCallback(async () => {
    setPageState("loading");
    try {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      const preview = previewFromTab(tab);
      setArticle(preview);
      setPageState(preview ? "ready" : "unsupported");
    } catch {
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
    void requestAuth({ type: "AUTH_STATUS" }).then((reply) => {
      if (!active) return;
      if (reply.ok) {
        setSession(reply.status);
        setSessionState(reply.status.authenticated ? "signed-in" : "signed-out");
      } else {
        setAuthError(reply.message);
        setSessionState("signed-out");
      }
    }).catch(() => {
      if (active) {
        setAuthError("Could not connect to the extension session. Reopen Quiescent.");
        setSessionState("signed-out");
      }
    });
    void Promise.resolve().then(updatePage);
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

  const handleLogin = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (authBusy) return;
    const values = new FormData(event.currentTarget);
    const email = String(values.get("email") ?? "").trim();
    const password = String(values.get("password") ?? "");
    setAuthBusy(true);
    setAuthError("");
    try {
      const reply = await requestAuth({ type: "AUTH_LOGIN", email, password });
      if (!reply.ok) throw new Error(reply.message);
      setSession(reply.status);
      setSessionState("signed-in");
    } catch (error) {
      setAuthError(error instanceof Error ? error.message : "Could not sign in.");
    } finally {
      setAuthBusy(false);
    }
  };

  const handleSignup = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (authBusy) return;
    const values = new FormData(event.currentTarget);
    const email = String(values.get("signup-email") ?? "").trim();
    const password = String(values.get("signup-password") ?? "");
    const confirmation = String(values.get("signup-confirmation") ?? "");
    if (password !== confirmation) { setAuthError("Passwords do not match."); return; }
    setAuthBusy(true);
    setAuthError("");
    try {
      const response = await fetch(new URL("/auth/sign-up", import.meta.env.VITE_API_BASE_URL || "http://localhost:3000"), {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      if (!response.ok) {
        const body = await response.json().catch(() => null) as { error?: { message?: string } } | null;
        throw new Error(body?.error?.message || `Could not create account (${response.status}).`);
      }
      setAuthView("login");
      setAuthError("Account created. Sign in to continue.");
    } catch (error) {
      setAuthError(error instanceof Error ? error.message : "Could not create account.");
    } finally { setAuthBusy(false); }
  };
  const handleLogout = async () => {
    setAuthBusy(true);
    setAuthError("");
    try {
      const reply = await requestAuth({ type: "AUTH_LOGOUT" });
      if (!reply.ok) throw new Error(reply.message);
      setSession({ authenticated: false });
      setSessionState("signed-out");
    } catch (error) {
      setAuthError(error instanceof Error ? error.message : "Could not sign out.");
    } finally {
      setAuthBusy(false);
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

      {sessionState === "loading" && <p role="status">Restoring session…</p>}
      {sessionState === "signed-out" && (
        <section aria-label={authView === "login" ? "Sign in" : "Create account"} className="auth-section">
          <h2>{authView === "login" ? "Sign in to Quiescent" : "Create your account"}</h2>
          {authView === "login" ? (
            <form onSubmit={(event) => void handleLogin(event)}>
              <label htmlFor="email">Email</label><input autoComplete="email" id="email" name="email" required type="email" />
              <label htmlFor="password">Password</label><input autoComplete="current-password" id="password" name="password" required type="password" />
              <button disabled={authBusy} type="submit">{authBusy ? "Signing in…" : "Sign in"}</button>
            </form>
          ) : (
            <form onSubmit={(event) => void handleSignup(event)}>
              <label htmlFor="signup-email">Email</label><input autoComplete="email" id="signup-email" name="signup-email" required type="email" />
              <label htmlFor="signup-password">Password</label><input autoComplete="new-password" id="signup-password" minLength={8} name="signup-password" required type="password" />
              <label htmlFor="signup-confirmation">Confirm password</label><input autoComplete="new-password" id="signup-confirmation" minLength={8} name="signup-confirmation" required type="password" />
              <button disabled={authBusy} type="submit">{authBusy ? "Creating account…" : "Create account"}</button>
            </form>
          )}
          <button className="auth-link" onClick={() => { setAuthView(authView === "login" ? "signup" : "login"); setAuthError(""); }} type="button">
            {authView === "login" ? "Create an account" : "Back to sign in"}
          </button>
        </section>
      )}      {sessionState === "signed-in" && (
        <section aria-label="Account" className="auth-account">
          <span>Signed in as {session.email}</span>
          <button disabled={authBusy} onClick={() => void handleLogout()} type="button">Sign out</button>
        </section>
      )}
      {authError && <p className="status-error" role="alert">{authError}</p>}

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
            <button className="save-button" disabled type="button">Add to Quiescent</button>
            <p className="save-hint">Article saving is coming soon.</p>
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

