import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import App from "../src/popup/App";

const runtimeListeners = new Set<(message: unknown, sender: unknown) => void>();
const activatedListeners = new Set<() => void>();
const updatedListeners = new Set<(tabId: number, changeInfo: { url?: string; title?: string; status?: string }) => void>();
const queryTabsMock = vi.fn<
  () => Promise<Array<{ id: number; url?: string; title?: string }>>
>();

beforeEach(() => {
  vi.stubEnv("VITE_API_BASE_URL", "http://localhost:3000");
  vi.stubEnv("VITE_DEV_USER_ID", "00000000-0000-4000-8000-000000000001");
  vi.stubEnv("VITE_ENABLE_STATE_PREVIEW", "false");
  queryTabsMock.mockReset();
  queryTabsMock.mockResolvedValue([
    { id: 7, url: "https://example.com/article", title: "Example article" },
  ]);

  vi.stubGlobal("chrome", {
    runtime: {
      onMessage: {
        addListener: vi.fn((listener) => runtimeListeners.add(listener)),
        removeListener: vi.fn((listener) => runtimeListeners.delete(listener)),
      },
    },
    tabs: {
      query: queryTabsMock,
      sendMessage: vi.fn().mockResolvedValue({ ok: true, progress: 42 }),
      onActivated: {
        addListener: vi.fn((listener) => activatedListeners.add(listener)),
        removeListener: vi.fn((listener) => activatedListeners.delete(listener)),
      },
      onUpdated: {
        addListener: vi.fn((listener) => updatedListeners.add(listener)),
        removeListener: vi.fn((listener) => updatedListeners.delete(listener)),
      },
    },
  });
});

afterEach(() => {
  cleanup();
  runtimeListeners.clear();
  activatedListeners.clear();
  updatedListeners.clear();
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});

describe("App", () => {
  it("previews the active HTTP page and falls back to its hostname for a missing title", async () => {
    queryTabsMock.mockResolvedValueOnce([
      { id: 7, url: "https://example.com/story#section" },
    ]);

    render(<App />);

    expect(await screen.findByText("https://example.com/story")).toBeDefined();
    expect(screen.getAllByText("example.com")).toHaveLength(2);
    expect(screen.getByRole("button", { name: "Add to Quiescent" }).hasAttribute("disabled")).toBe(false);
  });

  it("posts the active page with the configured test user ID", async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, status: 201 });
    vi.stubGlobal("fetch", fetchMock);
    queryTabsMock.mockResolvedValueOnce([
      { id: 7, url: "https://example.com/article#part", title: "  Example article  " },
    ]);
    render(<App />);

    fireEvent.click(await screen.findByRole("button", { name: "Add to Quiescent" }));
    expect(await screen.findByText("Saved to Read later")).toBeDefined();
    expect(fetchMock).toHaveBeenCalledOnce();
    const [url, options] = fetchMock.mock.calls[0];
    expect(url.toString()).toBe("http://localhost:3000/articles");
    expect(options).toMatchObject({
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title: "Example article",
        url: "https://example.com/article",
        userId: "00000000-0000-4000-8000-000000000001",
      }),
    });
    expect(screen.getByRole("button", { name: "Saved" }).hasAttribute("disabled")).toBe(true);
  });

  it("shows an already saved state for HTTP 409", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: false, status: 409 }));
    render(<App />);

    fireEvent.click(await screen.findByRole("button", { name: "Add to Quiescent" }));

    expect(await screen.findByText("Already in your library")).toBeDefined();
    expect(screen.getByRole("button", { name: "Already saved" }).hasAttribute("disabled")).toBe(true);
  });

  it("allows retry after a failed save", async () => {
    const fetchMock = vi.fn()
      .mockRejectedValueOnce(new Error("offline"))
      .mockResolvedValueOnce({ ok: true, status: 201 });
    vi.stubGlobal("fetch", fetchMock);
    render(<App />);

    fireEvent.click(await screen.findByRole("button", { name: "Add to Quiescent" }));
    expect((await screen.findByText("Couldn’t save this article")).closest('[role="status"]')).not.toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Retry" }));
    expect(await screen.findByText("Saved to Read later")).toBeDefined();
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("disables saving when the development configuration is missing", async () => {
    vi.stubEnv("VITE_DEV_USER_ID", "");
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    render(<App />);

    const button = await screen.findByRole("button", { name: "Add to Quiescent" });
    expect(button.hasAttribute("disabled")).toBe(true);
    expect(screen.getByText("Set the API URL and test user ID to enable saving.")).toBeDefined();
    fireEvent.click(button);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("switches the preview when the active tab changes", async () => {
    render(<App />);
    expect(await screen.findByText("https://example.com/article")).toBeDefined();
    queryTabsMock.mockResolvedValueOnce([
      { id: 8, url: "https://another.example/story", title: "Another story" },
    ]);

    activatedListeners.forEach((listener) => listener());

    expect(await screen.findByText("Another story")).toBeDefined();
    expect(screen.queryByText("Example article")).toBeNull();
  });

  it("updates the preview when the active page navigates", async () => {
    render(<App />);
    expect(await screen.findByText("https://example.com/article")).toBeDefined();
    queryTabsMock.mockResolvedValueOnce([
      { id: 7, url: "https://example.com/new-story", title: "New story" },
    ]);

    updatedListeners.forEach((listener) => listener(7, { url: "https://example.com/new-story" }));

    expect(await screen.findByText("New story")).toBeDefined();
    expect(screen.queryByText("Example article")).toBeNull();
  });

  it("prevents repeat save requests while one is pending", async () => {
    let finishRequest: ((value: { ok: boolean; status: number }) => void) | undefined;
    const fetchMock = vi.fn().mockImplementation(() => new Promise((resolve) => {
      finishRequest = resolve;
    }));
    vi.stubGlobal("fetch", fetchMock);
    render(<App />);

    const button = await screen.findByRole("button", { name: "Add to Quiescent" });
    fireEvent.click(button);
    expect(await screen.findByRole("button", { name: "Saving…" })).toBeDefined();
    fireEvent.click(button);
    expect(fetchMock).toHaveBeenCalledOnce();

    finishRequest?.({ ok: true, status: 201 });
    expect(await screen.findByText("Saved to Read later")).toBeDefined();
  });

  it("does not offer save on browser pages", async () => {
    queryTabsMock.mockResolvedValueOnce([
      { id: 9, url: "chrome://extensions" },
    ]);
    render(<App />);

    expect(await screen.findByText("Unsupported page")).toBeDefined();
    expect(screen.queryByRole("button", { name: "Add to Quiescent" })).toBeNull();
  });
  it("does not offer save when the tab has no URL", async () => {
    queryTabsMock.mockResolvedValue([{ id: 9 }]);
    vi.stubGlobal("fetch", vi.fn());
    render(<App />);

    expect(await screen.findByText("Unsupported page")).toBeDefined();
    expect(screen.queryByRole("button", { name: "Add to Quiescent" })).toBeNull();
    expect(fetch).not.toHaveBeenCalled();
  });

  it("announces loading and exposes named keyboard-focusable actions", async () => {
    let finishQuery: ((tabs: Array<{ id: number; url: string; title: string }>) => void) | undefined;
    queryTabsMock.mockImplementationOnce(() => new Promise((resolve) => {
      finishQuery = resolve;
    }));
    render(<App />);

    expect(screen.getByRole("status", { name: "Save article" }).textContent).toContain("Checking page");
    await waitFor(() => expect(queryTabsMock).toHaveBeenCalledOnce());
    finishQuery?.([{ id: 7, url: "https://example.com/article", title: "Example article" }]);
    const saveButton = await screen.findByRole("button", { name: "Add to Quiescent" });
    saveButton.focus();
    expect(document.activeElement).toBe(saveButton);
    expect(screen.getByRole("button", { name: "Open app" })).toBeDefined();
    expect(screen.getByRole("button", { name: "Reading progress" })).toBeDefined();
  });

  it("does not save stale metadata if the URL changes before the click is processed", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    render(<App />);
    const button = await screen.findByRole("button", { name: "Add to Quiescent" });
    queryTabsMock.mockResolvedValueOnce([{ id: 7, url: "https://example.com/new", title: "New page" }]);
    queryTabsMock.mockResolvedValueOnce([{ id: 7, url: "https://example.com/new", title: "New page" }]);

    fireEvent.click(button);

    expect(await screen.findByText("New page")).toBeDefined();
    expect(fetchMock).not.toHaveBeenCalled();
  });
  it("renders the Quiescent heading", () => {
    render(<App />);

    const heading = screen.getByRole("heading", {
      level: 1,
      name: "Quiescent",
    });

    expect(heading).toBeDefined();
  });

  it("opens the Quiescent web app in a new tab when the button is clicked", () => {
    const openSpy = vi.spyOn(window, "open").mockImplementation(() => null);

    render(<App />);

    const button = screen.getByRole("button", { name: "Open app" });

    fireEvent.click(button);

    expect(openSpy).toHaveBeenCalledWith("http://localhost:5173", "_blank");
  });

  it("displays the initial progress returned by the active tab", async () => {
    render(<App />);

    fireEvent.click(screen.getByRole("button", { name: "Reading progress" }));

    await waitFor(() => {
      expect(chrome.tabs.sendMessage).toHaveBeenCalledWith(7, {
        type: "START_READING_PROGRESS",
      });
    });

    expect(await screen.findByText("42%")).toBeDefined();
    expect(screen.getByRole("progressbar").getAttribute("aria-valuenow")).toBe(
      "42",
    );
  });

  it("keeps displaying subsequent scroll updates from the tracked tab", async () => {
    render(<App />);
    fireEvent.click(screen.getByRole("button", { name: "Reading progress" }));
    expect(await screen.findByText("42%")).toBeDefined();

    runtimeListeners.forEach((listener) =>
      listener(
        {
          type: "READING_PROGRESS_UPDATE",
          progress: 57,
          url: "https://example.com/article",
        },
        { tab: { id: 7 } },
      ),
    );

    expect(await screen.findByText("57%")).toBeDefined();
  });

  it("ignores progress updates from an earlier page in the same tab", async () => {
    render(<App />);
    fireEvent.click(screen.getByRole("button", { name: "Reading progress" }));
    expect(await screen.findByText("42%")).toBeDefined();

    runtimeListeners.forEach((listener) =>
      listener(
        {
          type: "READING_PROGRESS_UPDATE",
          progress: 90,
          url: "https://example.com/previous-article",
        },
        { tab: { id: 7 } },
      ),
    );

    expect(screen.getByText("42%")).toBeDefined();
    expect(screen.queryByText("90%")).toBeNull();
  });

  it("shows a clear fallback on unsupported pages", async () => {
    queryTabsMock.mockResolvedValue([
      { id: 9, url: "chrome://extensions" },
    ]);

    render(<App />);
    fireEvent.click(screen.getByRole("button", { name: "Reading progress" }));

    expect(
      await screen.findByText(/Reading progress isn't available on this page/i),
    ).toBeDefined();
    expect(chrome.tabs.sendMessage).not.toHaveBeenCalled(); // stop before start reading progress
  });
});
