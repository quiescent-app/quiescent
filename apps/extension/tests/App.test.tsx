import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, waitFor } from "@testing-library/react";
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
    sendMessage.mockResolvedValueOnce({ ok: true, result: { authenticated: true } }).mockResolvedValueOnce({ ok: true, result: "not-saved" }).mockResolvedValueOnce({ ok: true, result: "saved" });
    render(<App />);
    const save = await screen.findByRole("button", { name: "Add to Quiescent" });
    await waitFor(() => expect(save.hasAttribute("disabled")).toBe(false));
    expect(sendMessage).toHaveBeenCalledWith({ type: "CHECK_ARTICLE", url: "https://example.com/story" });
    fireEvent.click(save);
    expect(await screen.findByRole("button", { name: "Saved" })).toBeDefined();
    expect(sendMessage).toHaveBeenCalledWith({ type: "SAVE_ARTICLE", article: { title: "Story", url: "https://example.com/story" } });
  });
  it("shows an existing article before saving", async () => {
    sendMessage.mockResolvedValueOnce({ ok: true, result: { authenticated: true } }).mockResolvedValueOnce({ ok: true, result: "saved" });
    render(<App />);
    const button = await screen.findByRole("button", { name: "Already saved" });
    expect(button.hasAttribute("disabled")).toBe(true);
  });
  it("handles a duplicate returned when saving", async () => {
    sendMessage.mockResolvedValueOnce({ ok: true, result: { authenticated: true } }).mockResolvedValueOnce({ ok: true, result: "not-saved" }).mockResolvedValueOnce({ ok: true, result: "already-saved" });
    render(<App />);
    const save = await screen.findByRole("button", { name: "Add to Quiescent" });
    await waitFor(() => expect(save.hasAttribute("disabled")).toBe(false));
    fireEvent.click(save);
    expect((await screen.findByRole("button", { name: "Already saved" })).hasAttribute("disabled")).toBe(true);
  });
  it("allows saving when the status lookup fails and reports a failed save", async () => {
    sendMessage.mockResolvedValueOnce({ ok: true, result: { authenticated: true } }).mockResolvedValueOnce({ ok: false }).mockResolvedValueOnce({ ok: false });
    render(<App />);
    const save = await screen.findByRole("button", { name: "Add to Quiescent" });
    await screen.findByText("Could not check saved status. You can still try saving.");
    expect(save.hasAttribute("disabled")).toBe(false);
    fireEvent.click(save);
    expect(await screen.findByRole("alert")).toHaveProperty("textContent", "Could not save. Try again.");
    expect(save.hasAttribute("disabled")).toBe(false);
  });
  it("asks for sign in when the article lookup finds an expired session", async () => {
    sendMessage.mockResolvedValueOnce({ ok: true, result: { authenticated: true } }).mockResolvedValueOnce({ ok: false, authRequired: true });
    render(<App />);
    expect(await screen.findByRole("button", { name: "Sign in through the app" })).toBeDefined();
    expect(screen.getByRole("button", { name: "Add to Quiescent" }).hasAttribute("disabled")).toBe(true);
  });
  it("ignores a save response after the active tab changes", async () => {
    let finishSave!: (value: unknown) => void;
    sendMessage.mockResolvedValueOnce({ ok: true, result: { authenticated: true } }).mockResolvedValueOnce({ ok: true, result: "not-saved" }).mockImplementationOnce(() => new Promise(resolve => { finishSave = resolve; })).mockResolvedValueOnce({ ok: true, result: "not-saved" });
    render(<App />);
    const save = await screen.findByRole("button", { name: "Add to Quiescent" });
    await waitFor(() => expect(save.hasAttribute("disabled")).toBe(false));
    fireEvent.click(save);
    query.mockResolvedValue([{ id: 8, title: "Second Story", url: "https://example.com/second" }]);
    const onActivated = (chrome.tabs.onActivated.addListener as ReturnType<typeof vi.fn>).mock.calls[0]?.[0] as () => void;
    await act(async () => { onActivated(); });
    await screen.findByText("Second Story");
    await act(async () => { finishSave({ ok: true, result: "saved" }); });
    expect(screen.queryByRole("button", { name: "Saved" })).toBeNull();
    expect(screen.getByRole("button", { name: "Add to Quiescent" })).toBeDefined();
  });
  it("ignores a lookup response after the active tab changes", async () => {
    let finishLookup!: (value: unknown) => void;
    sendMessage.mockResolvedValueOnce({ ok: true, result: { authenticated: true } }).mockImplementationOnce(() => new Promise(resolve => { finishLookup = resolve; })).mockResolvedValueOnce({ ok: true, result: "not-saved" });
    render(<App />);
    await screen.findByRole("button", { name: "Checking..." });
    query.mockResolvedValue([{ id: 8, title: "Second Story", url: "https://example.com/second" }]);
    const onActivated = (chrome.tabs.onActivated.addListener as ReturnType<typeof vi.fn>).mock.calls[0]?.[0] as () => void;
    await act(async () => { onActivated(); });
    await screen.findByText("Second Story");
    await act(async () => { finishLookup({ ok: true, result: "saved" }); });
    const save = await screen.findByRole("button", { name: "Add to Quiescent" });
    await waitFor(() => expect(save.hasAttribute("disabled")).toBe(false));
    expect(screen.queryByRole("button", { name: "Already saved" })).toBeNull();
  });
});
