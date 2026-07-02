import { fileURLToPath } from "node:url";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { defineConfig } from "vite";

export default defineConfig({
  root: fileURLToPath(new URL("./client", import.meta.url)),
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: { "@": fileURLToPath(new URL("./client/src", import.meta.url)) },
  },
  server: {
    port: 5173,
    // Forward API calls to the Express + tRPC server so the browser sees one origin.
    proxy: {
      "/api": { target: "http://localhost:3001", changeOrigin: true },
    },
  },
  build: {
    outDir: fileURLToPath(new URL("./dist/client", import.meta.url)),
    emptyOutDir: true,
  },
});
