import { describe, expect, it } from "vitest";

import {
  DatabaseConfigurationError,
  getDatabaseUrl,
} from "../src/config/database.js";

describe("getDatabaseUrl", () => {
  it("returns a valid PostgreSQL URL", () => {
    const value = "postgresql://user:secret@example.neon.tech/neondb";

    expect(getDatabaseUrl({ DATABASE_URL: value })).toBe(value);
  });

  it("rejects a missing URL", () => {
    expect(() => getDatabaseUrl({})).toThrow(DatabaseConfigurationError);
    expect(() => getDatabaseUrl({})).toThrow("DATABASE_URL is required");
  });
});
