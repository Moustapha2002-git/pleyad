import { router } from "../trpc";
import { adminRouter } from "./admin";
import { analyticsRouter } from "./analytics";
import { authRouter } from "./auth";
import { callsRouter } from "./calls";
import { coachingRouter } from "./coaching";
import { collectionsRouter } from "./collections";
import { devRouter } from "./dev";
import { invitesRouter } from "./invites";
import { mentorRouter } from "./mentor";
import { messagesRouter } from "./messages";
import { notificationsRouter } from "./notifications";
import { orgRouter } from "./org";
import { pathsRouter } from "./paths";
import { playlistsRouter } from "./playlists";
import { quizzesRouter } from "./quizzes";
import { sessionsRouter } from "./sessions";

export const appRouter = router({
  auth: authRouter,
  collections: collectionsRouter,
  paths: pathsRouter,
  playlists: playlistsRouter,
  org: orgRouter,
  mentor: mentorRouter,
  messages: messagesRouter,
  notifications: notificationsRouter,
  calls: callsRouter,
  sessions: sessionsRouter,
  coaching: coachingRouter,
  quizzes: quizzesRouter,
  admin: adminRouter,
  analytics: analyticsRouter,
  invites: invitesRouter,
  dev: devRouter,
});

export type AppRouter = typeof appRouter;
