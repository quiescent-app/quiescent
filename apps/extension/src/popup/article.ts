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

export function getSaveConfiguration(): { apiOrigin: string; userId: string } | null {
  const apiOrigin = import.meta.env.VITE_API_BASE_URL?.trim();
  const userId = import.meta.env.VITE_DEV_USER_ID?.trim();

  if (!apiOrigin || !userId) return null;

  try {
    const url = new URL(apiOrigin);
    if ((url.protocol !== "http:" && url.protocol !== "https:") ||
      url.pathname !== "/" || url.search || url.hash ||
      !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(userId)) {
      return null;
    }
    return { apiOrigin: url.origin, userId };
  } catch {
    return null;
  }
}

export async function saveArticle(
  article: ArticlePreview,
  configuration: { apiOrigin: string; userId: string },
): Promise<"saved" | "already-saved"> {
  const response = await fetch(new URL("/articles", configuration.apiOrigin), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      title: article.title,
      url: article.url,
      userId: configuration.userId,
    }),
  });

  if (response.status === 409) return "already-saved";
  if (!response.ok) throw new Error(`Save failed with status ${response.status}`);
  return "saved";
}
