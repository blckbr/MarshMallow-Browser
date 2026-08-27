import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { resolve } from "node:path";

const devPort = Number(process.env.MARSHMALLOW_VITE_PORT || 1421);

export default defineConfig({
  plugins: [react()],
  clearScreen: false,
  base: "./",
  server: {
    host: "127.0.0.1",
    port: Number.isFinite(devPort) ? devPort : 1421,
    strictPort: true,
  },
  build: {
    rollupOptions: {
      input: {
        main: resolve(import.meta.dirname, "index.html"),
        watchHost: resolve(import.meta.dirname, "watch-host.html"),
      },
    },
  },
});
