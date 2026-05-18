import { defineConfig } from "vite";
import vue from "@vitejs/plugin-vue";

const bestdoriProxy = {
  target: "https://bestdori.com",
  changeOrigin: true,
  rewrite: (path) => path.replace(/^\/bestdori/, ""),
};

export default defineConfig({
  plugins: [vue()],
  server: {
    proxy: {
      "/bestdori": bestdoriProxy,
    },
  },
  preview: {
    proxy: {
      "/bestdori": bestdoriProxy,
    },
  },
});
