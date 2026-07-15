import { randomBytes } from "node:crypto";
import { z } from "zod";
import { db, mentorshipRepo, organizationsRepo, usersRepo } from "@pleyad/db";
import { hashPassword } from "../auth/password";
import { adminProcedure, router } from "../trpc";

const ROLE = z.enum(["member", "mentor", "admin"]);

export const adminRouter = router({
  /** Members of the active workspace, each with their assigned mentor (if a learner). */
  members: adminProcedure.query(async ({ ctx }) => {
    const [members, assignments] = await Promise.all([
      organizationsRepo.getOrganizationMembers(db, ctx.tenant.organizationId),
      mentorshipRepo.getOrgMentorAssignments(db, ctx.tenant.organizationId),
    ]);
    const mentorByLearner = new Map(assignments.map((a) => [a.learnerUserId, a.mentorUserId]));
    return members.map((m) => ({ ...m, mentorUserId: mentorByLearner.get(m.userId) ?? null }));
  }),

  /**
   * Add a member by email. If they don't have a Pleyad account yet, one is created
   * and a temporary password is returned once (for the admin to share). Email-based
   * invites and CSV bulk import are planned follow-ups.
   */
  addMember: adminProcedure
    .input(z.object({ name: z.string().min(2), email: z.string().email(), role: ROLE }))
    .mutation(async ({ ctx, input }) => {
      const existingUser = await usersRepo.getUserByEmail(db, input.email);
      let tempPassword: string | null = null;
      let user = existingUser;
      if (!user) {
        tempPassword = randomBytes(5).toString("hex"); // 10-char one-time password
        user = await usersRepo.createUser(db, {
          name: input.name,
          email: input.email,
          passwordHash: await hashPassword(tempPassword),
        });
      }
      await organizationsRepo.joinOrganization(db, user.id, ctx.tenant.organizationId, input.role);
      await organizationsRepo.setMembershipRole(db, user.id, ctx.tenant.organizationId, input.role);
      return { userId: user.id, tempPassword };
    }),

  setRole: adminProcedure
    .input(z.object({ userId: z.number(), role: ROLE }))
    .mutation(async ({ ctx, input }) => {
      await organizationsRepo.setMembershipRole(
        db,
        input.userId,
        ctx.tenant.organizationId,
        input.role,
      );
      return { ok: true };
    }),

  /** Assign a mentor to a learner (single-mentor model in V1 — replaces any existing). */
  assignMentor: adminProcedure
    .input(z.object({ learnerUserId: z.number(), mentorUserId: z.number() }))
    .mutation(async ({ ctx, input }) => {
      const current = await mentorshipRepo.getMentorsForLearner(
        db,
        ctx.tenant.organizationId,
        input.learnerUserId,
      );
      for (const m of current) {
        await mentorshipRepo.unassignLearner(
          db,
          ctx.tenant.organizationId,
          m.id,
          input.learnerUserId,
        );
      }
      await mentorshipRepo.assignLearner(
        db,
        ctx.tenant.organizationId,
        input.mentorUserId,
        input.learnerUserId,
      );
      return { ok: true };
    }),

  unassignMentor: adminProcedure
    .input(z.object({ learnerUserId: z.number(), mentorUserId: z.number() }))
    .mutation(async ({ ctx, input }) => {
      await mentorshipRepo.unassignLearner(
        db,
        ctx.tenant.organizationId,
        input.mentorUserId,
        input.learnerUserId,
      );
      return { ok: true };
    }),

  /** Rename the active workspace (org settings). */
  renameWorkspace: adminProcedure
    .input(z.object({ name: z.string().min(2).max(120) }))
    .mutation(async ({ ctx, input }) => {
      await organizationsRepo.renameOrganization(
        db,
        ctx.tenant.organizationId,
        input.name.trim(),
      );
      return { ok: true };
    }),
});
