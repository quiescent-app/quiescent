import "dotenv/config";

import { defineConfig } from "drizzle-kit";

import { getDatabaseUrl } from "./db/config.js";

export default defineConfig({
  dialect: "postgresql",
  schema: "./schema/*.schema.ts",
  out: "./drizzle",
  dbCredentials: {
    url: getDatabaseUrl(),
  },
});
