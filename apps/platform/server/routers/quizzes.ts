import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { db, notificationsRepo, quizzesRepo } from "@pleyad/db";
import { router, tenantProcedure } from "../trpc";

const CAN_COACH = ["mentor", "admin", "owner"];
function assertCoach(role: string) {
  if (!CAN_COACH.includes(role)) throw new TRPCError({ code: "FORBIDDEN" });
}

const questionSchema = z.object({
  prompt: z.string().min(1),
  options: z.array(z.string().min(1)).min(2).max(4),
  correctIndex: z.number().int().min(0),
});

export const quizzesRouter = router({
  /** Quizzes for a specific learner (mentor view). */
  forLearner: tenantProcedure
    .input(z.object({ learnerUserId: z.number() }))
    .query(({ ctx, input }) => {
      assertCoach(ctx.tenant.role);
      return quizzesRepo.getQuizzesForLearner(db, ctx.tenant.organizationId, input.learnerUserId);
    }),

  /** The current learner's own quizzes. */
  mine: tenantProcedure.query(({ ctx }) =>
    quizzesRepo.getQuizzesForLearner(db, ctx.tenant.organizationId, ctx.tenant.userId),
  ),

  create: tenantProcedure
    .input(
      z.object({
        learnerUserId: z.number(),
        title: z.string().min(1),
        questions: z.array(questionSchema).min(1),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      assertCoach(ctx.tenant.role);
      // Guard: correctIndex must be within the question's options.
      for (const q of input.questions) {
        if (q.correctIndex >= q.options.length) {
          throw new TRPCError({ code: "BAD_REQUEST", message: "Invalid correct answer" });
        }
      }
      const id = await quizzesRepo.createQuiz(db, {
        organizationId: ctx.tenant.organizationId,
        mentorUserId: ctx.tenant.userId,
        learnerUserId: input.learnerUserId,
        title: input.title,
        questions: input.questions,
      });
      await notificationsRepo.notify(db, {
        organizationId: ctx.tenant.organizationId,
        userId: input.learnerUserId,
        type: "quiz",
        title: "New quiz to take",
        body: input.title,
        linkTo: "/mentoring",
      });
      return { id };
    }),

  /** Load a quiz to take (no correct answers exposed). */
  take: tenantProcedure.input(z.object({ quizId: z.number() })).query(async ({ ctx, input }) => {
    const quiz = await quizzesRepo.getQuizForTaking(
      db,
      ctx.tenant.organizationId,
      input.quizId,
      ctx.tenant.userId,
    );
    if (!quiz) throw new TRPCError({ code: "NOT_FOUND" });
    return quiz;
  }),

  /** Submit answers — graded server-side. */
  submit: tenantProcedure
    .input(z.object({ quizId: z.number(), answers: z.array(z.number().int()) }))
    .mutation(({ ctx, input }) =>
      quizzesRepo.submitAttempt(
        db,
        ctx.tenant.organizationId,
        input.quizId,
        ctx.tenant.userId,
        input.answers,
      ),
    ),

  delete: tenantProcedure
    .input(z.object({ quizId: z.number() }))
    .mutation(({ ctx, input }) => {
      assertCoach(ctx.tenant.role);
      return quizzesRepo.deleteQuiz(db, ctx.tenant.organizationId, input.quizId, ctx.tenant.userId);
    }),
});
