import { router } from "../trpc";
import { authRouter } from "./auth";
import { collectionsRouter } from "./collections";
import { pathsRouter } from "./paths";

export const appRouter = router({
  auth: authRouter,
  collections: collectionsRouter,
  paths: pathsRouter,
});

export type AppRouter = typeof appRouter;
