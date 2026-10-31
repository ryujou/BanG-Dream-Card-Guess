import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import { playwright } from "@vitest/browser-playwright";
export default defineConfig({
  plugins: [react()],
  test: {
    projects: [
      {
        extends: true,
        test: {
          name: "unit",
          include: ["tests/client/**/*.test.ts", "tests/games/**/*.test.ts"],
          testTimeout: 20000,
        },
      },
      {
        extends: true,
        optimizeDeps: {
          include: ["react-dom/client", "react/jsx-runtime", "react/jsx-dev-runtime", "react-router-dom", "motion/react", "lucide-react", "@remotion/player", "remotion"],
        },
        test: {
          name: "browser",
          setupFiles: ["tests/client/browser.setup.ts"],
          include: ["tests/client/**/*.browser.test.tsx"],
          testTimeout: 20000,
          browser: {
            enabled: true,
            headless: true,
            provider: playwright({
              launchOptions: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH
                ? { executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH }
                : { channel: "chrome" },
              contextOptions: { reducedMotion: "reduce" },
            }),
            instances: [{ browser: "chromium" }],
            viewport: { width: 1280, height: 900 },
          },
        },
      },
    ],
    coverage: {
      provider: "v8",
      include: ["src/client/**/*.ts", "src/client/**/*.tsx"],
      reporter: ["text", "html", "json-summary"],
      reportsDirectory: "artifacts/coverage/frontend",
      reportOnFailure: true,
      thresholds: {
        lines: 90,
        statements: 90,
        branches: 85,
        functions: 85,
        "src/client/lib/home-theme.ts": { statements: 100, branches: 100, functions: 100, lines: 100 },
      },
    },
  },
});
