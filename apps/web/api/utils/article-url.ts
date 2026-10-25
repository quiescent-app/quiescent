export function normalizeArticleUrl(url: string): string {
  const parsed = new URL(url);

  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
    throw new Error("Article URL must use HTTP or HTTPS");
  }

  parsed.hash = "";

  return parsed.toString();
}

export function getArticleDomain(url: string): string {
  return new URL(url).hostname;
}
