import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  base: "/",
  build: {
    outDir: "dist",
    assetsDir: "assets",
    emptyOutDir: true,
  },
  server: {
    port: 5173,
    proxy: {
      "/api": {
        target: "https://subs-manager-backend-ag8gejsit-shans-projects-f903a935.vercel.app",
        changeOrigin: true,
      },
    },
  },
});





