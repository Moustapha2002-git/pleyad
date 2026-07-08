// Public surface of @pleyad/db — imported by the API and other packages.
export * from "./schema";
export { db } from "./client";
export type { DB } from "./client";
export type { TenantContext } from "./repositories/context";
export * as collectionsRepo from "./repositories/collections.repo";
export * as resourcesRepo from "./repositories/resources.repo";
export * as usersRepo from "./repositories/users.repo";
export * as organizationsRepo from "./repositories/organizations.repo";
export * as pathsRepo from "./repositories/paths.repo";
export * as mentorshipRepo from "./repositories/mentorship.repo";
export * as messagesRepo from "./repositories/messages.repo";
export * as sessionsRepo from "./repositories/sessions.repo";
export * as coachingRepo from "./repositories/coaching.repo";
export * as quizzesRepo from "./repositories/quizzes.repo";
