import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      "@": resolve(__dirname, "./src"),
    },
  },
  test: {
    environment: "jsdom",
    setupFiles: resolve(__dirname, "./vitest.setup.ts"),
    globals: true,
    css: false,
    coverage: {
      provider: "v8",
      reportsDirectory: resolve(__dirname, "./coverage"),
    },
  },
});

