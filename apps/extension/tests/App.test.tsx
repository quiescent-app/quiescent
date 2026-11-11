import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import App from "../src/popup/App";

const queryTabs = vi.fn();
const sendAuth = vi.fn();
const tabListeners = new Set<() => void>();
const runtimeListeners = new Set<() => void>();

beforeEach(() => {
  queryTabs.mockReset();
  sendAuth.mockReset();
  queryTabs.mockResolvedValue([{ id: 7, url: "https://example.com/article", title: "Example article" }]);
  sendAuth.mockResolvedValue({ ok: true, status: { authenticated: false } });
  vi.stubGlobal("chrome", {
    runtime: {
      sendMessage: sendAuth,
      onMessage: { addListener: (listener: () => void) => runtimeListeners.add(listener), removeListener: (listener: () => void) => runtimeListeners.delete(listener) },
    },
    tabs: {
      query: queryTabs,
      sendMessage: vi.fn().mockResolvedValue({ ok: true, progress: 42 }),
      onActivated: { addListener: (listener: () => void) => tabListeners.add(listener), removeListener: (listener: () => void) => tabListeners.delete(listener) },
      onUpdated: { addListener: (listener: () => void) => tabListeners.add(listener), removeListener: (listener: () => void) => tabListeners.delete(listener) },
    },
  });
});

afterEach(() => {
  cleanup();
  runtimeListeners.clear();
  tabListeners.clear();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("extension authentication", () => {
  it("shows sign-in and keeps article saving disabled", async () => {
    render(<App />);
    expect(await screen.findByRole("button", { name: "Sign in" })).toBeDefined();
    const save = await screen.findByRole("button", { name: "Add to Quiescent" });
    expect(save.hasAttribute("disabled")).toBe(true);
    fireEvent.click(save);
    expect(sendAuth).toHaveBeenCalledWith({ type: "AUTH_STATUS" });
  });

  it("signs in with credentials and shows the account", async () => {
    sendAuth.mockResolvedValueOnce({ ok: true, status: { authenticated: false } })
      .mockResolvedValueOnce({ ok: true, status: { authenticated: true, email: "reader@example.com" } });
    render(<App />);
    fireEvent.change(await screen.findByLabelText("Email"), { target: { value: "reader@example.com" } });
    fireEvent.change(screen.getByLabelText("Password"), { target: { value: "password123" } });
    fireEvent.click(screen.getByRole("button", { name: "Sign in" }));
    expect(await screen.findByText("Signed in as reader@example.com")).toBeDefined();
    expect(sendAuth).toHaveBeenCalledWith({ type: "AUTH_LOGIN", email: "reader@example.com", password: "password123" });
  });

  it("restores and signs out of an existing session", async () => {
    sendAuth.mockResolvedValueOnce({ ok: true, status: { authenticated: true, email: "reader@example.com" } })
      .mockResolvedValueOnce({ ok: true, status: { authenticated: false } });
    render(<App />);
    fireEvent.click(await screen.findByRole("button", { name: "Sign out" }));
    expect(await screen.findByRole("button", { name: "Sign in" })).toBeDefined();
    expect(sendAuth).toHaveBeenCalledWith({ type: "AUTH_LOGOUT" });
  });

  it("shows an API login error", async () => {
    sendAuth.mockResolvedValueOnce({ ok: true, status: { authenticated: false } })
      .mockResolvedValueOnce({ ok: false, message: "Invalid email or password" });
    render(<App />);
    fireEvent.change(await screen.findByLabelText("Email"), { target: { value: "reader@example.com" } });
    fireEvent.change(screen.getByLabelText("Password"), { target: { value: "wrongpass" } });
    fireEvent.click(screen.getByRole("button", { name: "Sign in" }));
    expect(await screen.findByRole("alert")).toHaveProperty("textContent", "Invalid email or password");
  });

  it("still tracks reading progress", async () => {
    render(<App />);
    fireEvent.click(screen.getByRole("button", { name: "Reading progress" }));
    await waitFor(() => expect(screen.getByRole("progressbar").getAttribute("aria-valuenow")).toBe("42"));
  });
});
