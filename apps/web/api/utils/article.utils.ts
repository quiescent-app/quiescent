import { NeonDbError } from "@neondatabase/serverless";
import { DrizzleQueryError } from "drizzle-orm/errors";

import { AppError, HttpStatus } from "../errors/appError.js";

export function isArticleUrlUniqueViolation(error: unknown): boolean {
  const cause = error instanceof DrizzleQueryError ? error.cause : error;

  return (
    cause instanceof NeonDbError &&
    cause.code === "23505" &&
    cause.constraint === "articles_user_url_unique"
  );
}

export function normalizeArticleUrl(url: string): string {
  const parsed = new URL(url);

  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
    throw new Error("Article URL must use HTTP or HTTPS");
  }

  parsed.hash = "";

  return parsed.toString();
}

export function normalizeUrl(url: string): string {
  try {
    return normalizeArticleUrl(url);
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
