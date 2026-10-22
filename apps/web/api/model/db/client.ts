import { neon } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";

import { getDatabaseUrl } from "./config.js";
import { users } from "../schema/user.schema.js";

export function createDatabase(databaseUrl = getDatabaseUrl()) {
  const client = neon(databaseUrl);
  return drizzle({ client, schema: { users } });
} 

export type Database = ReturnType<typeof createDatabase>;

export const database = createDatabase();
