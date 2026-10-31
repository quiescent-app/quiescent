import { describe, expect, it } from "vitest";

import { previewFromTab } from "../src/popup/article";

describe("previewFromTab", () => {
  it.each([
    ["http://example.com/story#section", "http://example.com/story"],
    ["https://example.com/story#section", "https://example.com/story"],
  ])("normalizes %s", (input, expected) => {
    expect(previewFromTab({ url: input, title: "  Story  " } as chrome.tabs.Tab)).toEqual({
      title: "Story",
      source: "example.com",
      url: expected,
    });
  });

  it.each(["chrome://extensions", "file:///article.html", "ftp://example.com/story", "not a url"])(
    "rejects unsupported URL %s",
    (url) => expect(previewFromTab({ url } as chrome.tabs.Tab)).toBeNull(),
  );

  it("rejects a missing URL", () => {
    expect(previewFromTab({} as chrome.tabs.Tab)).toBeNull();
  });
});
