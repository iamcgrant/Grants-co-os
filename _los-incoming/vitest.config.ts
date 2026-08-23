import path from "node:path";
import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

const root = fileURLToPath(new URL(".", import.meta.url));

export default defineConfig({
  resolve: {
    alias: {
      "@los": path.join(root, "src/los"),
    },
  },
  test: {
    include: ["tests/**/*.test.ts"],
  },
});
