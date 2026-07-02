import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { pathsRepo } from "@pleyad/db";
import { router, tenantProcedure } from "../trpc";

const DIMENSION = z.enum(["knowledge", "skills", "human_development"]);
const PLATFORM = z.enum(["youtube", "coursera", "udemy", "edx", "linkedin", "other"]);

export const pathsRouter = router({
  list: tenantProcedure.query(({ ctx }) => pathsRepo.listPaths(ctx.tenant)),

  progression: tenantProcedure.query(({ ctx }) => pathsRepo.getProgression(ctx.tenant)),

  get: tenantProcedure.input(z.object({ id: z.number() })).query(async ({ ctx, input }) => {
    const path = await pathsRepo.getPath(ctx.tenant, input.id);
    if (!path) throw new TRPCError({ code: "NOT_FOUND", message: "Path not found" });
    return path;
  }),

  create: tenantProcedure
    .input(
      z.object({
        title: z.string().min(1),
        description: z.string().optional(),
        dimensions: z.array(DIMENSION).default([]),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const id = await pathsRepo.createPath(ctx.tenant, input);
      return { id };
    }),

  addItem: tenantProcedure
    .input(
      z.object({
        pathId: z.number(),
        title: z.string().min(1),
        platform: PLATFORM.default("other"),
        url: z.string().optional(),
      }),
    )
    .mutation(({ ctx, input }) =>
      pathsRepo.addItemToPath(ctx.tenant, input.pathId, {
        title: input.title,
        platform: input.platform,
        url: input.url,
      }),
    ),

  setItemStatus: tenantProcedure
    .input(z.object({ resourceId: z.number(), done: z.boolean() }))
    .mutation(({ ctx, input }) =>
      pathsRepo.setItemStatus(ctx.tenant, input.resourceId, input.done),
    ),
});
