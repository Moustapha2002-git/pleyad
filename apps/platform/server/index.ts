import "dotenv/config";
import { createExpressMiddleware } from "@trpc/server/adapters/express";
import express from "express";
import { createContext } from "./context";
import { appRouter } from "./routers";

const app = express();

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

const port = Number(process.env.PORT) || 3001;
app.listen(port, () => {
  console.log(`▲ Pleyad platform API listening on http://localhost:${port}`);
});
