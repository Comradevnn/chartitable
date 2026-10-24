import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    // Layer tests opt into a DOM per file with `// @vitest-environment happy-dom`.
    include: ["engine/**/*.test.ts", "seed/**/*.test.ts", "layer/test/**/*.test.ts"],
  },
});
