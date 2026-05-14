import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: ["tests/unit/**/*.test.{js,mjs}"],
    coverage: {
      provider: "v8",
      include: ["src/server/**/*.mjs"],
      reporter: ["text", "text-summary", "json", "html"],
      reportsDirectory: "./coverage",
    },
  },
});
