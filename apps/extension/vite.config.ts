import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import { fileURLToPath, URL } from "node:url";
import { readFileSync, writeFileSync } from "node:fs";
import { loadEnv } from "vite";

export default defineConfig(({ mode }) => ({
  plugins: [
    react(),
    {
      name: "api-host-permission",
      apply: "build",
      closeBundle() {
        const apiBaseUrl = loadEnv(mode, fileURLToPath(new URL(".", import.meta.url)), "VITE_").VITE_API_BASE_URL;
        if (!apiBaseUrl) return;

        const api = new URL(apiBaseUrl);
        if ((api.protocol !== "http:" && api.protocol !== "https:") ||
          api.pathname !== "/" || api.search || api.hash) {
          throw new Error("VITE_API_BASE_URL must be an HTTP(S) origin");
        }

        const manifestPath = fileURLToPath(new URL("./dist/manifest.json", import.meta.url));
        const manifest = JSON.parse(readFileSync(manifestPath, "utf8")) as Record<string, unknown>;
        manifest.host_permissions = [`${api.protocol}//${api.hostname}/*`];
        writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);
      },
    },
  ],
  test: {
    environment: "jsdom",
  },

  build: {
    rollupOptions: {
      input: {
        popup: fileURLToPath(new URL("./popup.html", import.meta.url)),
        background: fileURLToPath(
          new URL("./src/background/index.ts", import.meta.url),
        ),
        content: fileURLToPath(
          new URL("./src/content/index.ts", import.meta.url),
        ),
      },

      output: {
        entryFileNames: (chunkInfo) => {
          if (chunkInfo.name === "background") {
            return "background.js";
          }

          if (chunkInfo.name === "content") {
            return "content.js";
          }

          return "assets/[name]-[hash].js";
        },

        chunkFileNames: "assets/[name]-[hash].js",
        assetFileNames: "assets/[name]-[hash][extname]",
      },
    },
  },
}));
