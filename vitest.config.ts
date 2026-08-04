import { defineConfig } from "vitest/config";
import { fileURLToPath } from "node:url";

// Resolve the tsconfig "@/*" -> repo-root path alias during tests.
// Next's build resolves it, but vitest's default does not; this lets unit tests
// import modules that reference "@/lib/..." (e.g. lib/*/articles.ts, QC4 aggregation).
// Relative imports used by the calc pure-function tests keep working unchanged.
export default defineConfig({
  resolve: {
    alias: {
      "@": fileURLToPath(new URL(".", import.meta.url)).replace(/\/$/, ""),
    },
  },
});
