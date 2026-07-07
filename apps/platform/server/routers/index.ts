import { router } from "../trpc";
import { adminRouter } from "./admin";
import { authRouter } from "./auth";
import { callsRouter } from "./calls";
import { collectionsRouter } from "./collections";
import { devRouter } from "./dev";
import { mentorRouter } from "./mentor";
import { messagesRouter } from "./messages";
import { orgRouter } from "./org";
import { pathsRouter } from "./paths";
import { sessionsRouter } from "./sessions";

export const appRouter = router({
  auth: authRouter,
  collections: collectionsRouter,
  paths: pathsRouter,
  org: orgRouter,
  mentor: mentorRouter,
  messages: messagesRouter,
  calls: callsRouter,
  sessions: sessionsRouter,
  admin: adminRouter,
  dev: devRouter,
});

export type AppRouter = typeof appRouter;
