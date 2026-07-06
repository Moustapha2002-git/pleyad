import "dotenv/config";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createExpressMiddleware } from "@trpc/server/adapters/express";
import express from "express";
import { createContext } from "./context";
import { appRouter } from "./routers";

const isProd = process.env.NODE_ENV === "production";
const app = express();

// Behind a hosting proxy (Render/Fly/etc.) that terminates TLS — lets Express
// know the original request was https, so secure cookies work.
if (isProd) app.set("trust proxy", 1);

app.get("/health", (_req, res) => {
  res.json({ ok: true, service: "pleyad-platform" });
});

app.use(
  "/api/trpc",
  createExpressMiddleware({
    router: appRouter,
    createContext,
  }),
);

// In production, one server serves both the API (above) and the built client.
if (isProd) {
  const clientDir = fileURLToPath(new URL("../dist/client", import.meta.url));
  app.use(express.static(clientDir));
  // SPA fallback — any non-API GET returns index.html.
  app.get("*", (_req, res) => {
    res.sendFile(path.join(clientDir, "index.html"));
  });
}

const port = Number(process.env.PORT) || 3001;
app.listen(port, () => {
  console.log(`▲ Pleyad platform listening on port ${port} (${isProd ? "production" : "development"})`);
});
