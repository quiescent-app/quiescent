import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import App from "../src/popup/App";

const sendMessage = vi.fn();
const query = vi.fn();
beforeEach(() => {
  sendMessage.mockReset(); query.mockReset();
  sendMessage.mockResolvedValue({ ok: true, result: { authenticated: false } });
  query.mockResolvedValue([{ id: 7, title: "Story", url: "https://example.com/story" }]);
  vi.stubGlobal("chrome", { runtime: { id: "abcdefghijklmnopabcdefghijklmnop", sendMessage, onMessage: { addListener: vi.fn(), removeListener: vi.fn() } }, tabs: { query, sendMessage: vi.fn().mockResolvedValue({ ok: true, progress: 42 }), onActivated: { addListener: vi.fn(), removeListener: vi.fn() }, onUpdated: { addListener: vi.fn(), removeListener: vi.fn() } } });
});
afterEach(() => { cleanup(); vi.unstubAllGlobals(); vi.restoreAllMocks(); });

describe("popup auth handoff", () => {
  it("opens web login for a disconnected extension", async () => {
    const open = vi.spyOn(window, "open").mockImplementation(() => null);
    render(<App />);
    fireEvent.click(await screen.findByRole("button", { name: "Sign in through the app" }));
    expect(open).toHaveBeenCalledWith("http://localhost:5173/login?extensionId=abcdefghijklmnopabcdefghijklmnop", "_blank");
    expect(screen.getByRole("button", { name: "Add to Quiescent" }).hasAttribute("disabled")).toBe(true);
  });
  it("saves after an extension session is present", async () => {
    sendMessage.mockResolvedValueOnce({ ok: true, result: { authenticated: true } }).mockResolvedValueOnce({ ok: true, result: "saved" });
    render(<App />);
    fireEvent.click(await screen.findByRole("button", { name: "Add to Quiescent" }));
    expect(await screen.findByRole("button", { name: "Saved" })).toBeDefined();
    expect(sendMessage).toHaveBeenCalledWith({ type: "SAVE_ARTICLE", article: { title: "Story", url: "https://example.com/story" } });
  });
});
