import "dotenv/config";

import { migrate } from "drizzle-orm/neon-http/migrator";

import { database } from "./client.js";

await migrate(database, { migrationsFolder: "./drizzle" });
