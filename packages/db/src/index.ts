// Public surface of @pleyad/db — imported by the API and other packages.
export * from "./schema";
export { db } from "./client";
export type { DB } from "./client";
export type { TenantContext } from "./repositories/context";
export * as collectionsRepo from "./repositories/collections.repo";
export * as resourcesRepo from "./repositories/resources.repo";
