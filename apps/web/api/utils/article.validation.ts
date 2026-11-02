import { AppError, HttpStatus } from "../errors/appError.js";

const UUID_PATTERN = /^[\da-f]{8}-[\da-f]{4}-[\da-f]{4}-[\da-f]{4}-[\da-f]{12}$/i;

export function requireObjectBody(body: unknown): Record<string, unknown> {
  if (typeof body !== "object" || body === null || Array.isArray(body)) {
    throw new AppError(HttpStatus.BAD_REQUEST, "Request body must be a JSON object");
  }
  return body as Record<string, unknown>;
}

export function requireArticleId(id: unknown): string {
  if (typeof id !== "string" || !UUID_PATTERN.test(id)) {
    throw new AppError(HttpStatus.BAD_REQUEST, "Article ID must be a valid UUID");
  }
  return id;
}
