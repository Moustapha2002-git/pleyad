import { TRPCError } from "@trpc/server";
import { db, mentorshipRepo, organizationsRepo, pathsRepo, usersRepo } from "@pleyad/db";
import type { TenantContext } from "@pleyad/db";
import { setActiveOrgCookie } from "../auth/cookies";
import { hashPassword } from "../auth/password";
import { protectedProcedure, router } from "../trpc";

// Demo-only scaffolding so the mentor experience can be shown without the full
// admin console (Phase 2). Disabled in production.

const DEMO_LEARNERS = [
  { name: "Ahmed Diallo", email: "ahmed.learner@demo.pleyad.test" },
  { name: "Fatima Sy", email: "fatima.learner@demo.pleyad.test" },
];
const DEMO_PASSWORD = "demo1234";

async function ensureLearner(name: string, email: string) {
  const found = await usersRepo.getUserByEmail(db, email);
  if (found) return found;
  return usersRepo.createUser(db, {
    name,
    email,
    passwordHash: await hashPassword(DEMO_PASSWORD),
  });
}

export const devRouter = router({
  /** Turns the current user into a mentor in Innovation Academy with 2 assigned
   * learners who have some path progress, then switches into that workspace. */
  setupMentorDemo: protectedProcedure.mutation(async ({ ctx }) => {
    if (process.env.NODE_ENV === "production") {
      throw new TRPCError({ code: "FORBIDDEN", message: "Dev tools are disabled" });
    }

    const ia = await organizationsRepo.getOrganizationBySlug(db, "innovation-academy");
    if (!ia) throw new TRPCError({ code: "NOT_FOUND", message: "Innovation Academy not seeded" });

    // Current user becomes a mentor in Innovation Academy.
    await organizationsRepo.joinOrganization(db, ctx.user.id, ia.id, "mentor");
    await organizationsRepo.setMembershipRole(db, ctx.user.id, ia.id, "mentor");
    const mentorCtx: TenantContext = {
      db,
      organizationId: ia.id,
      userId: ctx.user.id,
      role: "mentor",
    };

    // Demo learners join and are assigned to this mentor.
    const learners = [];
    for (const l of DEMO_LEARNERS) {
      const user = await ensureLearner(l.name, l.email);
      await organizationsRepo.joinOrganization(db, user.id, ia.id, "member");
      await mentorshipRepo.assignLearner(db, ia.id, ctx.user.id, user.id);
      learners.push(user);
    }

    // Create org paths once, and give the first learner some progress.
    const existing = await pathsRepo.listPathsForUser(db, ia.id, ctx.user.id);
    if (existing.length === 0) {
      const learnerCtx: TenantContext = {
        db,
        organizationId: ia.id,
        userId: learners[0]!.id,
        role: "member",
      };
      const p1 = await pathsRepo.createPath(mentorCtx, {
        title: "Digital Skills Foundations",
        dimensions: ["knowledge", "skills"],
      });
      await pathsRepo.addItemToPath(mentorCtx, p1, { title: "Intro to Computers", platform: "youtube" });
      await pathsRepo.addItemToPath(mentorCtx, p1, { title: "Office Essentials", platform: "coursera" });

      const p2 = await pathsRepo.createPath(mentorCtx, {
        title: "Professional Soft Skills",
        dimensions: ["skills", "human_development"],
      });
      await pathsRepo.addItemToPath(mentorCtx, p2, { title: "Communication", platform: "linkedin" });
      await pathsRepo.addItemToPath(mentorCtx, p2, { title: "Teamwork & Resilience", platform: "edx" });

      const first = await pathsRepo.getPath(learnerCtx, p1);
      if (first && first.items[0]) {
        await pathsRepo.setItemStatus(learnerCtx, first.items[0].resourceId, true);
      }
    }

    setActiveOrgCookie(ctx.res, ia.publicId);

    return {
      workspace: ia.name,
      learners: DEMO_LEARNERS.map((l) => ({ ...l, password: DEMO_PASSWORD })),
    };
  }),
});
