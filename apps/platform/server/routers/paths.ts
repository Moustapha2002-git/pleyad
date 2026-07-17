import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { db, mentorshipRepo, notificationsRepo, organizationsRepo, pathsRepo } from "@pleyad/db";
import { router, tenantProcedure } from "../trpc";

const DIMENSION = z.enum(["knowledge", "skills", "human_development"]);
const PLATFORM = z.enum(["youtube", "coursera", "udemy", "edx", "linkedin", "other"]);
const CAN_ASSIGN = ["mentor", "admin", "owner"];

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

  /** Self-reported 0–100 progress on a skill/course (100 = completed). */
  setItemProgress: tenantProcedure
    .input(z.object({ resourceId: z.number(), progress: z.number().int().min(0).max(100) }))
    .mutation(({ ctx, input }) =>
      pathsRepo.setItemProgress(ctx.tenant, input.resourceId, input.progress),
    ),

  // ── Assignments ──────────────────────────────────────────────────────
  /** Paths assigned to the current user (the learner's own view). */
  assigned: tenantProcedure.query(({ ctx }) =>
    pathsRepo.getAssignedPaths(db, ctx.tenant.organizationId, ctx.tenant.userId),
  ),

  /** Paths assigned to a specific learner (mentor/admin view). */
  assignedTo: tenantProcedure
    .input(z.object({ learnerUserId: z.number() }))
    .query(({ ctx, input }) => {
      if (!CAN_ASSIGN.includes(ctx.tenant.role)) {
        throw new TRPCError({ code: "FORBIDDEN" });
      }
      return pathsRepo.getAssignedPaths(db, ctx.tenant.organizationId, input.learnerUserId);
    }),

  assign: tenantProcedure
    .input(
      z.object({
        collectionId: z.number(),
        learnerUserId: z.number(),
        dueAt: z.string().nullish(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      if (!CAN_ASSIGN.includes(ctx.tenant.role)) {
        throw new TRPCError({ code: "FORBIDDEN", message: "Only mentors can assign paths" });
      }
      const due = input.dueAt ? new Date(input.dueAt) : null;
      await pathsRepo.assignPath(
        db,
        ctx.tenant.organizationId,
        input.collectionId,
        input.learnerUserId,
        ctx.tenant.userId,
        due,
      );
      const path = await pathsRepo.getPath(ctx.tenant, input.collectionId);
      await notificationsRepo.notify(db, {
        organizationId: ctx.tenant.organizationId,
        userId: input.learnerUserId,
        type: "path_assigned",
        title: "New learning path assigned",
        body: path?.title ?? null,
        linkTo: `/paths/${input.collectionId}`,
      });
      return { ok: true };
    }),

  /**
   * Learners this user may bulk-assign the path to, with already-assigned flags.
   * Mentors see their own mentees; admins/owners see every learner in the org.
   */
  candidates: tenantProcedure
    .input(z.object({ collectionId: z.number() }))
    .query(async ({ ctx, input }) => {
      if (!CAN_ASSIGN.includes(ctx.tenant.role)) throw new TRPCError({ code: "FORBIDDEN" });

      const isAdmin = ctx.tenant.role === "admin" || ctx.tenant.role === "owner";
      const learners = isAdmin
        ? (await organizationsRepo.getOrganizationMembers(db, ctx.tenant.organizationId))
            .filter((m) => m.role === "member")
            .map((m) => ({ id: m.userId, name: m.name, email: m.email }))
        : await mentorshipRepo.getLearnersForMentor(
            db,
            ctx.tenant.organizationId,
            ctx.tenant.userId,
          );

      const assigned = new Set(
        await pathsRepo.getAssignedLearnerIds(db, ctx.tenant.organizationId, input.collectionId),
      );
      return learners.map((l) => ({
        id: l.id,
        name: l.name,
        email: l.email,
        alreadyAssigned: assigned.has(l.id),
      }));
    }),

  /** Assign one path to many learners at once (cohort action). */
  assignBulk: tenantProcedure
    .input(
      z.object({
        collectionId: z.number(),
        learnerUserIds: z.array(z.number()).min(1).max(500),
        dueAt: z.string().nullish(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      if (!CAN_ASSIGN.includes(ctx.tenant.role)) throw new TRPCError({ code: "FORBIDDEN" });
      const isAdmin = ctx.tenant.role === "admin" || ctx.tenant.role === "owner";
      const due = input.dueAt ? new Date(input.dueAt) : null;
      const path = await pathsRepo.getPath(ctx.tenant, input.collectionId);
      if (!path) throw new TRPCError({ code: "NOT_FOUND", message: "Path not found" });

      let assignedCount = 0;
      for (const learnerUserId of input.learnerUserIds) {
        // Mentors may only assign to their own mentees; admins to any learner.
        if (!isAdmin) {
          const mine = await mentorshipRepo.isMentorOf(
            db,
            ctx.tenant.organizationId,
            ctx.tenant.userId,
            learnerUserId,
          );
          if (!mine) continue;
        }
        await pathsRepo.assignPath(
          db,
          ctx.tenant.organizationId,
          input.collectionId,
          learnerUserId,
          ctx.tenant.userId,
          due,
        );
        await notificationsRepo.notify(db, {
          organizationId: ctx.tenant.organizationId,
          userId: learnerUserId,
          type: "path_assigned",
          title: "New learning path assigned",
          body: path.title,
          linkTo: `/paths/${input.collectionId}`,
        });
        assignedCount++;
      }
      return { assignedCount };
    }),

  unassign: tenantProcedure
    .input(z.object({ collectionId: z.number(), learnerUserId: z.number() }))
    .mutation(({ ctx, input }) => {
      if (!CAN_ASSIGN.includes(ctx.tenant.role)) {
        throw new TRPCError({ code: "FORBIDDEN" });
      }
      return pathsRepo.unassignPath(
        db,
        ctx.tenant.organizationId,
        input.collectionId,
        input.learnerUserId,
      );
    }),
});
