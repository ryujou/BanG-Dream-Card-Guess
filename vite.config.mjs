import { defineConfig } from "vite";

const bestdoriProxy = {
  target: "https://bestdori.com",
  changeOrigin: true,
  rewrite: (path) => path.replace(/^\/bestdori/, ""),
};

export default defineConfig({
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
