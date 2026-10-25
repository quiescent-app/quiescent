import type { PGlite } from "@electric-sql/pglite";
import { afterEach, describe, expect, it } from "vitest";

import { createTestDatabase } from "./database.js";

describe("database migration", () => {
  let client: PGlite;

  afterEach(async () => {
    if (client) await client.close();
  });

  it("creates the users table from an empty database", async () => {
    ({ client } = await createTestDatabase());

    const result = await client.query<{ table_name: string }>(
      "select table_name from information_schema.tables where table_schema = 'public' and table_name = 'users'",
    );

    expect(result.rows).toEqual([{ table_name: "users" }]);
  });

  it("creates the articles table from an empty database", async () => {
    ({ client } = await createTestDatabase());

    const result = await client.query<{ table_name: string }>(
      "select table_name from information_schema.tables where table_schema = 'public' and table_name = 'articles'",
    );

    expect(result.rows).toEqual([{ table_name: "articles" }]);
  });
});
