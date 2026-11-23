import { neon } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";

import { getDatabaseUrl } from "./config.js";
import { refreshTokens } from "../schema/refreshTokens.schema.js";
import { users } from "../schema/user.schema.js";
import { articles } from "../schema/article.schema.js";
import { readerResources } from "../schema/readerResource.schema.js";
import { readerSessions } from "../schema/readerSession.schema.js";

export function createDatabase(databaseUrl = getDatabaseUrl()) {
  const client = neon(databaseUrl);
  return drizzle({ client, schema: { users, refreshTokens, articles, readerResources, readerSessions } });
}

export type Database = ReturnType<typeof createDatabase>;

export const database = createDatabase();
