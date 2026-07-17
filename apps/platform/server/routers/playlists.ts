import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { collectionsRepo, db, pathsRepo } from "@pleyad/db";
import type { TenantContext } from "@pleyad/db";
import { router, tenantProcedure } from "../trpc";

const PLATFORM = z.enum(["youtube", "coursera", "udemy", "edx", "linkedin", "other"]);

/** Confirm the collection is a playlist the current user owns before mutating it. */
async function assertOwnedPlaylist(ctx: { tenant: TenantContext }, id: number) {
  const c = await collectionsRepo.getCollection(ctx.tenant, id);
  if (!c || c.kind !== "playlist" || c.ownerUserId !== ctx.tenant.userId) {
    throw new TRPCError({ code: "FORBIDDEN", message: "Not your playlist" });
  }
}

/**
 * Self-directed learning: a learner's own playlists (kind=playlist), curated from
 * external courses. Reuses the path engine (getPath / addItemToPath / setItemStatus)
 * but gates every write to playlists the caller owns.
 */
export const playlistsRouter = router({
  mine: tenantProcedure.query(({ ctx }) =>
    pathsRepo.listPlaylistsForOwner(db, ctx.tenant.organizationId, ctx.tenant.userId),
  ),

  create: tenantProcedure
    .input(z.object({ title: z.string().min(1) }))
    .mutation(async ({ ctx, input }) => {
      const id = await collectionsRepo.createCollection(ctx.tenant, {
        title: input.title,
        kind: "playlist",
      });
      return { id };
    }),

  get: tenantProcedure.input(z.object({ id: z.number() })).query(async ({ ctx, input }) => {
    await assertOwnedPlaylist(ctx, input.id);
    const playlist = await pathsRepo.getPath(ctx.tenant, input.id);
    if (!playlist) throw new TRPCError({ code: "NOT_FOUND" });
    return playlist;
  }),

  addItem: tenantProcedure
    .input(
      z.object({
        playlistId: z.number(),
        title: z.string().min(1),
        platform: PLATFORM.default("other"),
        url: z.string().optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      await assertOwnedPlaylist(ctx, input.playlistId);
      return pathsRepo.addItemToPath(ctx.tenant, input.playlistId, {
        title: input.title,
        platform: input.platform,
        url: input.url,
      });
    }),

  setItemStatus: tenantProcedure
    .input(z.object({ resourceId: z.number(), done: z.boolean() }))
    .mutation(({ ctx, input }) =>
      pathsRepo.setItemStatus(ctx.tenant, input.resourceId, input.done),
    ),

  setItemProgress: tenantProcedure
    .input(z.object({ resourceId: z.number(), progress: z.number().int().min(0).max(100) }))
    .mutation(({ ctx, input }) =>
      pathsRepo.setItemProgress(ctx.tenant, input.resourceId, input.progress),
    ),
});
