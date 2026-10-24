import "dotenv/config";

import { neon } from "@neondatabase/serverless";
import { describe, expect, it } from "vitest";

import {
  DatabaseConfigurationError,
  getDatabaseUrl,
} from "../../db/config.js";

describe("getDatabaseUrl", () => {
  it("returns a valid PostgreSQL URL", () => {
    const value = "postgresql://user:secret@example.neon.tech/neondb";

    expect(getDatabaseUrl({ DATABASE_URL: value })).toBe(value);
  });

  it("rejects a missing URL", () => {
    expect(() => getDatabaseUrl({})).toThrow(DatabaseConfigurationError);
    expect(() => getDatabaseUrl({})).toThrow("DATABASE_URL is required");
  });

  it.each([
    "not-a-url",
    "https://example.neon.tech/neondb",
    "postgresql://example.neon.tech/",
  ])("rejects an invalid PostgreSQL URL: %s", (value) => {
    expect(() => getDatabaseUrl({ DATABASE_URL: value })).toThrow(
      "DATABASE_URL must be a valid PostgreSQL URL",
    );
  });
});

describe("Neon database health", () => {
  it.skipIf(!process.env.DATABASE_URL)(
    "connects to the configured database and runs a health query",
    async () => {
      const sql = neon(getDatabaseUrl());
      const result = await sql`select 1 as healthy`;

      expect(result).toEqual([{ healthy: 1 }]);
    },
    15_000,
  );
});
