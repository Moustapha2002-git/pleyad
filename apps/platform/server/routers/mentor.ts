import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { db, mentorshipRepo, pathsRepo, usersRepo } from "@pleyad/db";
import { router, tenantProcedure } from "../trpc";

export const mentorRouter = router({
  /** Learners assigned to the current user (as mentor) in the active workspace. */
  myLearners: tenantProcedure.query(({ ctx }) =>
    mentorshipRepo.getLearnersForMentor(db, ctx.tenant.organizationId, ctx.tenant.userId),
  ),

  /** A learner's "progress CV": their 3-dimension gauges + paths. Guarded. */
  learnerProfile: tenantProcedure
    .input(z.object({ learnerId: z.number() }))
    .query(async ({ ctx, input }) => {
      const isAdmin = ctx.tenant.role === "owner" || ctx.tenant.role === "admin";
      const allowed =
        isAdmin ||
        (await mentorshipRepo.isMentorOf(
          db,
          ctx.tenant.organizationId,
          ctx.tenant.userId,
          input.learnerId,
        ));
      if (!allowed) throw new TRPCError({ code: "FORBIDDEN" });

      const learner = await usersRepo.getUserById(db, input.learnerId);
      if (!learner) throw new TRPCError({ code: "NOT_FOUND" });

      const [progression, paths] = await Promise.all([
        pathsRepo.getProgressionForUser(db, ctx.tenant.organizationId, input.learnerId),
        pathsRepo.listPathsForUser(db, ctx.tenant.organizationId, input.learnerId),
      ]);

      return {
        learner: { id: learner.id, name: learner.name, email: learner.email },
        progression,
        paths,
      };
    }),
});
