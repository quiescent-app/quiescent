import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

import { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";

import { articles } from "../../schema/article.schema.js";
import { refreshTokens } from "../../schema/refreshTokens.schema.js";
import { users } from "../../schema/user.schema.js";

const schema = { users, refreshTokens, articles };

const schemaPath = fileURLToPath(new URL("./schema.sql", import.meta.url));

export async function createTestDatabase() {
  const client = new PGlite();

  try {
    const database = drizzle(client, { schema });

    const schemaSql = readFileSync(schemaPath, "utf8");

    await client.exec(schemaSql);

    return { client, database };
  } catch (error) {
    await client.close();
    throw error;
  }
}
