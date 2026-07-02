import { router } from "../trpc";
import { authRouter } from "./auth";
import { collectionsRouter } from "./collections";

export const appRouter = router({
  auth: authRouter,
  collections: collectionsRouter,
});

export type AppRouter = typeof appRouter;
