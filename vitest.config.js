import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: ["tests/unit/**/*.test.{js,mjs,ts}", "tests/server/**/*.test.{js,mjs,ts}"],
    coverage: {
      provider: "v8",
      include: ["src/server/**/*.ts"],
      reporter: ["text", "text-summary", "json", "html"],
      reportsDirectory: "./coverage",
    },
  },
});
