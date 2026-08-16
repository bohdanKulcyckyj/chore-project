import { configDefaults, defineConfig } from "vitest/config";
import path from "path";

export default defineConfig({
  test: {
    // e2e/*.spec.ts is Playwright's, not vitest's
    exclude: [...configDefaults.exclude, "e2e/**"],

    // Default environment is node (for existing pipeline.test.ts and parser tests)
    environment: "node",

    // Override environment for specific test files
    environmentMatchGlobs: [
      // Browser environment tests run in happy-dom
      ["**/*.browser.test.ts", "happy-dom"],
    ],

    globals: true,

    // Increased timeout for PDF/OCR operations
    testTimeout: 120_000,
  },

  resolve: {
    alias: {
      "@": path.resolve(import.meta.dirname, "./src"),
    },
  },
});
