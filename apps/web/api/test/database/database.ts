import { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";
import { migrate } from "drizzle-orm/pglite/migrator";

import { users } from "../../model/schema/user.schema.js";

const schema = { users };

export async function createTestDatabase() {
  const client = new PGlite();
  const database = drizzle(client, { schema });

  await migrate(database, { migrationsFolder: "./model/drizzle" });

  return { client, database };
}
