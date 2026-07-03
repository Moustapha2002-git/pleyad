import { fileURLToPath } from "node:url";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import basicSsl from "@vitejs/plugin-basic-ssl";
import { defineConfig } from "vite";

export default defineConfig({
  root: fileURLToPath(new URL("./client", import.meta.url)),
  // basicSsl serves the dev app over https so phones get a secure context
  // (required for camera/microphone in the embedded video call).
  plugins: [react(), tailwindcss(), basicSsl()],
  resolve: {
    alias: { "@": fileURLToPath(new URL("./client/src", import.meta.url)) },
  },
  server: {
    port: 5173,
    // Bind to all interfaces so other devices on the same Wi-Fi (e.g. a phone)
    // can reach the app at http://<this-PC-LAN-IP>:5173.
    host: true,
    strictPort: true,
    // Allow access via the LAN IP / any host in dev (needed for phone testing).
    allowedHosts: true,
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
