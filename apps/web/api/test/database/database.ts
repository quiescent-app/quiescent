import { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";
import { migrate } from "drizzle-orm/pglite/migrator";

import { refreshTokens } from "../../schema/refreshTokens.schema.js";
import { users } from "../../schema/user.schema.js";

const schema = { users, refreshTokens };

export async function createTestDatabase() {
  const client = new PGlite();
  const database = drizzle(client, { schema });

  await migrate(database, { migrationsFolder: "./drizzle" });

  return { client, database };
}
