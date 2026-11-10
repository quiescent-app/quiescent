import { AppError, HttpStatus } from "../errors/appError.js";

export function normalizeArticleUrl(url: string): string {
  try {
    const parsed = new URL(url);

    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
      throw new Error("Article URL must use HTTP or HTTPS");
    }

    parsed.hash = "";
    return parsed.toString();
  } catch {
    throw new AppError(
      HttpStatus.BAD_REQUEST,
      "Article URL must be a valid HTTP or HTTPS URL",
    );
  }
}

export function getArticleDomain(url: string): string {
  return new URL(url).hostname;
}
