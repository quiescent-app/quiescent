import { NeonDbError } from "@neondatabase/serverless";
import { DrizzleQueryError } from "drizzle-orm/errors";

import type { AuthUser, User } from "../schema/user.schema.js";

export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

export function toAuthUser(user: User): AuthUser {
  const { id, email, createdAt, updatedAt } = user;
  return { id, email, createdAt, updatedAt };
}

export function isEmailUniqueViolation(error: unknown): boolean {
  const cause = error instanceof DrizzleQueryError ? error.cause : error;

  return (
    cause instanceof NeonDbError &&
    cause.code === "23505" &&
    cause.constraint === "users_email_unique"
  );
}
