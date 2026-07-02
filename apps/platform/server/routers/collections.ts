import { z } from "zod";
import { collectionsRepo } from "@pleyad/db";
import { router, tenantProcedure } from "../trpc";

/**
 * Tenant-scoped collections. Every procedure runs through `tenantProcedure`, so
 * `ctx.tenant` is a fully-resolved TenantContext and the repository automatically
 * scopes to the active organization — no organization id is ever accepted from the
 * client.
 */
export const collectionsRouter = router({
  list: tenantProcedure.query(({ ctx }) => collectionsRepo.listCollections(ctx.tenant)),

  create: tenantProcedure
    .input(
      z.object({
        title: z.string().min(1),
        description: z.string().optional(),
        goal: z.string().optional(),
        kind: z.enum(["playlist", "path"]).optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const id = await collectionsRepo.createCollection(ctx.tenant, input);
      return { id };
    }),
});
