import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { db, notificationsRepo, sessionsRepo } from "@pleyad/db";
import { router, tenantProcedure } from "../trpc";

const CAN_SCHEDULE = ["mentor", "admin", "owner"];

export const sessionsRouter = router({
  /** Upcoming scheduled sessions for the current user (mentor or learner). */
  mine: tenantProcedure.query(({ ctx }) =>
    sessionsRepo.getSessionsForUser(db, ctx.tenant.organizationId, ctx.tenant.userId),
  ),

  /** A mentor schedules a session with a learner. */
  schedule: tenantProcedure
    .input(
      z.object({
        learnerUserId: z.number(),
        title: z.string().min(1),
        scheduledAt: z.string(), // ISO / datetime-local string
        durationMinutes: z.number().int().positive().default(30),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      if (!CAN_SCHEDULE.includes(ctx.tenant.role)) {
        throw new TRPCError({ code: "FORBIDDEN", message: "Only mentors can schedule sessions" });
      }
      const when = new Date(input.scheduledAt);
      if (Number.isNaN(when.getTime())) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "Invalid date/time" });
      }
      const id = await sessionsRepo.scheduleSession(db, {
        organizationId: ctx.tenant.organizationId,
        mentorUserId: ctx.tenant.userId,
        learnerUserId: input.learnerUserId,
        title: input.title,
        scheduledAt: when,
        durationMinutes: input.durationMinutes,
        createdByUserId: ctx.tenant.userId,
      });
      await notificationsRepo.notify(db, {
        organizationId: ctx.tenant.organizationId,
        userId: input.learnerUserId,
        type: "session",
        title: "Mentoring session scheduled",
        body: `${input.title} · ${when.toLocaleString()}`,
        linkTo: "/schedule",
      });
      return { id };
    }),

  cancel: tenantProcedure
    .input(z.object({ id: z.number() }))
    .mutation(({ ctx, input }) =>
      sessionsRepo.cancelSession(db, ctx.tenant.organizationId, input.id, ctx.tenant.userId),
    ),

  /** Either participant moves a session to a new time; the other side is notified. */
  reschedule: tenantProcedure
    .input(
      z.object({
        id: z.number(),
        scheduledAt: z.string(),
        durationMinutes: z.number().int().positive().optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const when = new Date(input.scheduledAt);
      if (Number.isNaN(when.getTime())) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "Invalid date/time" });
      }
      const session = await sessionsRepo.rescheduleSession(
        db,
        ctx.tenant.organizationId,
        input.id,
        ctx.tenant.userId,
        when,
        input.durationMinutes,
      );
      if (!session) throw new TRPCError({ code: "NOT_FOUND", message: "Session not found" });

      const otherUserId =
        session.mentorUserId === ctx.tenant.userId ? session.learnerUserId : session.mentorUserId;
      await notificationsRepo.notify(db, {
        organizationId: ctx.tenant.organizationId,
        userId: otherUserId,
        type: "session",
        title: "Session rescheduled",
        body: `${session.title} · now ${when.toLocaleString()}`,
        linkTo: "/schedule",
      });
      return { ok: true };
    }),
});
