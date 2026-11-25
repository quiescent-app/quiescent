export type ArticlePreview = {
  title: string;
  url: string;
  source: string;
};

export function previewFromTab(tab: chrome.tabs.Tab | undefined): ArticlePreview | null {
  if (!tab?.url) return null;

  try {
    const url = new URL(tab.url);
    if (url.protocol !== "http:" && url.protocol !== "https:") return null;

    url.hash = "";
    return {
      title: tab.title?.trim() || url.hostname,
      url: url.toString(),
      source: url.hostname,
    };
  } catch {
    return null;
  }
}
