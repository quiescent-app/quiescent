import "dotenv/config";

import { defineConfig } from "drizzle-kit";

import { getDatabaseUrl } from "./model/db/config.js";

export default defineConfig({
  dialect: "postgresql",
  schema: "./model/schema/*.schema.ts",
  out: "./model/drizzle",
  dbCredentials: {
    url: getDatabaseUrl(),
  },
});
