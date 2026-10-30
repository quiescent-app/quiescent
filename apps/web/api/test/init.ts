import { execFileSync } from "node:child_process";
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";

const outputPath = resolve("test/database/schema.sql");

const sql = execFileSync("pnpm", ["exec", "drizzle-kit", "export"], {
  encoding: "utf8",
  shell: process.platform === "win32",
});

if (!sql.trim().startsWith("CREATE TABLE")) {
  throw new Error("Unexpected Drizzle Kit export output");
}

mkdirSync(dirname(outputPath), { recursive: true });
writeFileSync(outputPath, sql);

console.log("Test schema generated successfully.");
