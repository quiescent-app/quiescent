import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import App from "../src/popup/App";

const runtimeListeners = new Set<(message: unknown, sender: unknown) => void>();
const queryTabsMock = vi.fn<
  () => Promise<Array<{ id: number; url: string }>>
>();

beforeEach(() => {
  queryTabsMock.mockReset();
  queryTabsMock.mockResolvedValue([
    { id: 7, url: "https://example.com/article" },
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
      onActivated: { addListener: vi.fn(), removeListener: vi.fn() },
      onUpdated: { addListener: vi.fn(), removeListener: vi.fn() },
    },
  });
});

afterEach(() => {
  cleanup();
  runtimeListeners.clear();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("App", () => {
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
    queryTabsMock.mockResolvedValueOnce([
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
