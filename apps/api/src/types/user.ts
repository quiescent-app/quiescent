import type { users } from "../db/schema.js";

/** Database representation. Do not expose this type from HTTP responses. */
export type UserRecord = typeof users.$inferSelect;

export interface CreateUserInput {
  email: string;
  /** An already-hashed password. Plaintext must never reach the model layer. */
  password: string;
}
