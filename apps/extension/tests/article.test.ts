import { describe, expect, it } from "vitest";

import { previewFromTab } from "../src/popup/article";

describe("previewFromTab", () => {
  // A URL fragment points to a location within a page, not to a different article.
  it.each([
    { inputUrl: "http://example.com/story#section", expectedUrl: "http://example.com/story" },
    { inputUrl: "https://example.com/story#section", expectedUrl: "https://example.com/story" },
  ])("creates a preview and removes the fragment from $inputUrl", ({ inputUrl, expectedUrl }) => {
    // Only url and title are relevant to previewFromTab, so the rest of the Chrome tab is omitted.
    const tab = { url: inputUrl, title: "  Story  " } as chrome.tabs.Tab;

    expect(previewFromTab(tab)).toEqual({
      title: "Story",
      source: "example.com",
      url: expectedUrl,
    });
  });
  describe("browser-internal pages", () => {
    it("rejects a chrome URL", () => {
      const tab = { url: "chrome://extensions" } as chrome.tabs.Tab;

      expect(previewFromTab(tab)).toBeNull();
    });
  });

  describe("local files", () => {
    it("rejects a file URL", () => {
      const tab = { url: "file:///article.html" } as chrome.tabs.Tab;

      expect(previewFromTab(tab)).toBeNull();
    });
  });

  describe("unsupported protocols", () => {
    it("rejects an FTP URL", () => {
      const tab = { url: "ftp://example.com/story" } as chrome.tabs.Tab;

      expect(previewFromTab(tab)).toBeNull();
    });
  });

  describe("invalid URLs", () => {
    it("rejects a malformed URL", () => {
      const tab = { url: "not a url" } as chrome.tabs.Tab;

      expect(previewFromTab(tab)).toBeNull();
    });
  });
  // Some chrome tabs might not expose a url
  it("rejects a missing URL", () => {
    const tabWithoutUrl = {} as chrome.tabs.Tab;

    expect(previewFromTab(tabWithoutUrl)).toBeNull();
  });
});
