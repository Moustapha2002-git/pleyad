import { router } from "../trpc";
import { authRouter } from "./auth";
import { collectionsRouter } from "./collections";
import { devRouter } from "./dev";
import { mentorRouter } from "./mentor";
import { messagesRouter } from "./messages";
import { orgRouter } from "./org";
import { pathsRouter } from "./paths";

export const appRouter = router({
  auth: authRouter,
  collections: collectionsRouter,
  paths: pathsRouter,
  org: orgRouter,
  mentor: mentorRouter,
  messages: messagesRouter,
  dev: devRouter,
});

export type AppRouter = typeof appRouter;
