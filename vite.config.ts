import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "");
  const apiTarget = env.API_PROXY_TARGET || `http://127.0.0.1:${env.PORT || "8080"}`;
  return {
  plugins: [react()],
  build: { outDir: "dist/client", emptyOutDir: true, copyPublicDir: false },
  server: {
    port: 5173,
    strictPort: true,
    proxy: {
      "/api": apiTarget,
      "/note-shooter-api": apiTarget,
      "/ws": { target: apiTarget, ws: true },
      "/uploads": apiTarget,
      "/cards": apiTarget,
      "/bestdori": apiTarget,
    },
  },
  preview: { port: 4173, strictPort: true },
  };
});
