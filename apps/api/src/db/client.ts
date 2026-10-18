import { neon } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";

import { getDatabaseUrl } from "../config/database.js";
import * as schema from "./schema.js";

export function createDatabase(databaseUrl = getDatabaseUrl()) {
  const client = neon(databaseUrl);
  return drizzle({ client, schema });
} 

export type Database = ReturnType<typeof createDatabase>;

export const database = createDatabase();
