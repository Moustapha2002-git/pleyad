import { randomBytes } from "node:crypto";
import { z } from "zod";
import { db, invitesRepo, mentorshipRepo, organizationsRepo, usersRepo } from "@pleyad/db";
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

  // ── Join links ─────────────────────────────────────────────────────────
  createInvite: adminProcedure
    .input(z.object({ role: ROLE }))
    .mutation(async ({ ctx, input }) => {
      const invite = await invitesRepo.createInvite(
        db,
        ctx.tenant.organizationId,
        input.role,
        ctx.tenant.userId,
      );
      return { id: invite.id, token: invite.token, role: invite.role };
    }),

  listInvites: adminProcedure.query(async ({ ctx }) => {
    const rows = await invitesRepo.listActiveInvites(db, ctx.tenant.organizationId);
    return rows.map((i) => ({
      id: i.id,
      token: i.token,
      role: i.role,
      usedCount: i.usedCount,
      createdAt: i.createdAt,
    }));
  }),

  revokeInvite: adminProcedure
    .input(z.object({ inviteId: z.number() }))
    .mutation(async ({ ctx, input }) => {
      await invitesRepo.revokeInvite(db, ctx.tenant.organizationId, input.inviteId);
      return { ok: true };
    }),

  // ── Bulk import ────────────────────────────────────────────────────────
  /**
   * Import a cohort at once (rows parsed client-side from CSV). Creates missing
   * accounts with one-time passwords, adds everyone as learners, and optionally
   * assigns them all to a mentor. Returns per-row results incl. the passwords —
   * shown once, so the admin can distribute credentials through their own channel.
   */
  bulkImport: adminProcedure
    .input(
      z.object({
        rows: z
          .array(z.object({ name: z.string().min(1), email: z.string().email() }))
          .min(1)
          .max(500),
        mentorUserId: z.number().optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const results: {
        email: string;
        name: string;
        status: "created" | "added" | "already_member";
        tempPassword: string | null;
      }[] = [];

      for (const row of input.rows) {
        const email = row.email.trim().toLowerCase();
        let user = await usersRepo.getUserByEmail(db, email);
        let tempPassword: string | null = null;
        let status: (typeof results)[number]["status"];

        if (!user) {
          tempPassword = randomBytes(5).toString("hex");
          user = await usersRepo.createUser(db, {
            name: row.name.trim(),
            email,
            passwordHash: await hashPassword(tempPassword),
          });
          status = "created";
        } else {
          const membership = await organizationsRepo.getMembership(
            db,
            user.id,
            ctx.tenant.organizationId,
          );
          status = membership ? "already_member" : "added";
        }

        await organizationsRepo.joinOrganization(db, user.id, ctx.tenant.organizationId, "member");
        if (input.mentorUserId && status !== "already_member") {
          await mentorshipRepo.assignLearner(
            db,
            ctx.tenant.organizationId,
            input.mentorUserId,
            user.id,
          );
        }
        results.push({ email, name: row.name.trim(), status, tempPassword });
      }
      return { results };
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

  /** White-label branding: logo (small data-URL or https) + primary color. */
  updateBranding: adminProcedure
    .input(
      z.object({
        primaryColor: z
          .string()
          .regex(/^#[0-9a-fA-F]{6}$/, "Color must be a hex value like #0a2540")
          .nullable(),
        logoUrl: z
          .string()
          .max(400_000, "Logo image is too large — use one under ~300 KB")
          .refine(
            (v) => v.startsWith("data:image/") || v.startsWith("https://"),
            "Logo must be an uploaded image or an https URL",
          )
          .nullable(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const enabled = Boolean(input.primaryColor || input.logoUrl);
      await organizationsRepo.updateBranding(db, ctx.tenant.organizationId, {
        logoUrl: input.logoUrl,
        primaryColor: input.primaryColor,
        brandingEnabled: enabled,
      });
      return { ok: true };
    }),
});
