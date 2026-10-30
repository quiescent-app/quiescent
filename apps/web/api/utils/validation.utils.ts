import { AppError, HttpStatus } from "../errors/appError.js";

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function requireObjectBody(body: unknown): Record<string, unknown> {
  if (typeof body !== "object" || body === null || Array.isArray(body)) {
    throw new AppError(HttpStatus.BAD_REQUEST, "Request body must be a JSON object");
  }
  return body as Record<string, unknown>;
}

export function requireCredentials(body: unknown): { email: string; password: string } {
  const values = requireObjectBody(body);
  const { email, password } = values;

  if (typeof email !== "string" || !EMAIL_PATTERN.test(email.trim())) {
    throw new AppError(HttpStatus.BAD_REQUEST, "A valid email is required");
  }
  if (typeof password !== "string" || password.length === 0) {
    throw new AppError(HttpStatus.BAD_REQUEST, "A password is required");
  }

  return { email, password };
}

export function requireRefreshToken(body: unknown): string {
  const values = requireObjectBody(body);
  if (typeof values.refreshToken !== "string" || values.refreshToken.length === 0) {
    throw new AppError(HttpStatus.BAD_REQUEST, "A refresh token is required");
  }
  return values.refreshToken;
}
