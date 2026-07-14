import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { coachingRepo, db, notificationsRepo } from "@pleyad/db";
import { router, tenantProcedure } from "../trpc";

const CAN_COACH = ["mentor", "admin", "owner"];
function assertCoach(role: string) {
  if (!CAN_COACH.includes(role)) throw new TRPCError({ code: "FORBIDDEN" });
}

export const coachingRouter = router({
  // ── Tasks ──────────────────────────────────────────────────────────────
  /** Tasks for a specific learner (mentor view). */
  tasksFor: tenantProcedure
    .input(z.object({ learnerUserId: z.number() }))
    .query(({ ctx, input }) => {
      assertCoach(ctx.tenant.role);
      return coachingRepo.getTasksForLearner(db, ctx.tenant.organizationId, input.learnerUserId);
    }),

  /** The current user's own tasks (learner view). */
  myTasks: tenantProcedure.query(({ ctx }) =>
    coachingRepo.getTasksForLearner(db, ctx.tenant.organizationId, ctx.tenant.userId),
  ),

  createTask: tenantProcedure
    .input(
      z.object({
        learnerUserId: z.number(),
        title: z.string().min(1),
        instructions: z.string().optional(),
        dueAt: z.string().nullish(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      assertCoach(ctx.tenant.role);
      const id = await coachingRepo.createTask(db, {
        organizationId: ctx.tenant.organizationId,
        mentorUserId: ctx.tenant.userId,
        learnerUserId: input.learnerUserId,
        title: input.title,
        instructions: input.instructions ?? null,
        dueAt: input.dueAt ? new Date(input.dueAt) : null,
      });
      await notificationsRepo.notify(db, {
        organizationId: ctx.tenant.organizationId,
        userId: input.learnerUserId,
        type: "task",
        title: "New task assigned",
        body: input.title,
        linkTo: "/mentoring",
      });
      return { id };
    }),

  /** Learner marks their own task done/undone. */
  setTaskDone: tenantProcedure
    .input(z.object({ taskId: z.number(), done: z.boolean() }))
    .mutation(({ ctx, input }) =>
      coachingRepo.setTaskStatus(
        db,
        ctx.tenant.organizationId,
        input.taskId,
        ctx.tenant.userId,
        input.done,
      ),
    ),

  deleteTask: tenantProcedure
    .input(z.object({ taskId: z.number() }))
    .mutation(({ ctx, input }) => {
      assertCoach(ctx.tenant.role);
      return coachingRepo.deleteTask(db, ctx.tenant.organizationId, input.taskId, ctx.tenant.userId);
    }),

  // ── Feedback ───────────────────────────────────────────────────────────
  feedbackFor: tenantProcedure
    .input(z.object({ learnerUserId: z.number() }))
    .query(({ ctx, input }) => {
      assertCoach(ctx.tenant.role);
      return coachingRepo.getFeedbackForLearner(db, ctx.tenant.organizationId, input.learnerUserId);
    }),

  myFeedback: tenantProcedure.query(({ ctx }) =>
    coachingRepo.getFeedbackForLearner(db, ctx.tenant.organizationId, ctx.tenant.userId),
  ),

  addFeedback: tenantProcedure
    .input(z.object({ learnerUserId: z.number(), body: z.string().min(1) }))
    .mutation(async ({ ctx, input }) => {
      assertCoach(ctx.tenant.role);
      const id = await coachingRepo.addFeedback(db, {
        organizationId: ctx.tenant.organizationId,
        mentorUserId: ctx.tenant.userId,
        learnerUserId: input.learnerUserId,
        body: input.body,
      });
      await notificationsRepo.notify(db, {
        organizationId: ctx.tenant.organizationId,
        userId: input.learnerUserId,
        type: "feedback",
        title: "New feedback from your mentor",
        body: input.body.slice(0, 140),
        linkTo: "/mentoring",
      });
      return { id };
    }),
});
