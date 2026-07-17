import { randomBytes } from "node:crypto";
import { TRPCError } from "@trpc/server";
import { z } from "zod";
import {
  db,
  directoryRepo,
  invitesRepo,
  mentorshipRepo,
  organizationsRepo,
  usersRepo,
} from "@pleyad/db";
import { hashPassword } from "../auth/password";
import { adminProcedure, router } from "../trpc";

const INACTIVE_DAYS = 7;
const DAY_MS = 86_400_000;

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

  // ── Learner directory ──────────────────────────────────────────────────
  /**
   * Paginated learner directory with derived stats. Aggregation is batched in
   * the repo; filter/sort/paging run here on the computed rows (fine well past
   * pilot scale — revisit with SQL paging beyond ~10k learners per org).
   */
  learners: adminProcedure
    .input(
      z.object({
        search: z.string().optional(),
        status: z
          .enum(["all", "active", "inactive", "completed", "suspended"])
          .default("all"),
        mentorUserId: z.number().optional(),
        sort: z.enum(["name", "progress", "recent", "newest"]).default("name"),
        page: z.number().int().min(1).default(1),
        pageSize: z.number().int().min(6).max(48).default(12),
      }),
    )
    .query(async ({ ctx, input }) => {
      const rows = await directoryRepo.listLearnerDirectory(db, ctx.tenant.organizationId);
      const now = Date.now();
      const isActive = (r: (typeof rows)[number]) =>
        !!r.lastActivityAt && now - r.lastActivityAt.getTime() <= INACTIVE_DAYS * DAY_MS;
      const isCompleted = (r: (typeof rows)[number]) =>
        r.assignedCount > 0 && r.avgProgress === 100;

      const stats = {
        total: rows.length,
        active: rows.filter((r) => r.membershipStatus === "active" && isActive(r)).length,
        completed: rows.filter(isCompleted).length,
        avgProgress: rows.length
          ? Math.round(rows.reduce((s, r) => s + r.avgProgress, 0) / rows.length)
          : 0,
      };

      const q = input.search?.trim().toLowerCase();
      let filtered = rows.filter((r) => {
        if (q && !`${r.name ?? ""} ${r.email}`.toLowerCase().includes(q)) return false;
        if (input.mentorUserId && !r.mentors.some((m) => m.id === input.mentorUserId))
          return false;
        switch (input.status) {
          case "active":
            return r.membershipStatus === "active" && isActive(r);
          case "inactive":
            return r.membershipStatus === "active" && !isActive(r);
          case "completed":
            return isCompleted(r);
          case "suspended":
            return r.membershipStatus === "suspended";
          default:
            return true;
        }
      });

      filtered = filtered.sort((a, b) => {
        switch (input.sort) {
          case "progress":
            return b.avgProgress - a.avgProgress;
          case "recent":
            return (b.lastActivityAt?.getTime() ?? 0) - (a.lastActivityAt?.getTime() ?? 0);
          case "newest":
            return b.joinedAt.getTime() - a.joinedAt.getTime();
          default:
            return (a.name ?? a.email).localeCompare(b.name ?? b.email);
        }
      });

      const totalFiltered = filtered.length;
      const start = (input.page - 1) * input.pageSize;
      return {
        stats,
        totalFiltered,
        page: input.page,
        pageCount: Math.max(1, Math.ceil(totalFiltered / input.pageSize)),
        rows: filtered.slice(start, start + input.pageSize),
      };
    }),

  /** Suspend or reactivate a learner (blocks their access to this workspace). */
  setLearnerStatus: adminProcedure
    .input(z.object({ userId: z.number(), status: z.enum(["active", "suspended"]) }))
    .mutation(async ({ ctx, input }) => {
      const membership = await organizationsRepo.getMembership(
        db,
        input.userId,
        ctx.tenant.organizationId,
      );
      if (!membership || membership.role !== "member") {
        throw new TRPCError({ code: "BAD_REQUEST", message: "Only learners can be suspended" });
      }
      await directoryRepo.setLearnerStatus(
        db,
        ctx.tenant.organizationId,
        input.userId,
        input.status,
      );
      return { ok: true };
    }),

  /** Remove a learner from this workspace (their global account is untouched). */
  removeLearner: adminProcedure
    .input(z.object({ userId: z.number() }))
    .mutation(async ({ ctx, input }) => {
      const membership = await organizationsRepo.getMembership(
        db,
        input.userId,
        ctx.tenant.organizationId,
      );
      if (!membership || membership.role !== "member") {
        throw new TRPCError({ code: "BAD_REQUEST", message: "Only learners can be removed here" });
      }
      await directoryRepo.removeLearnerFromOrg(db, ctx.tenant.organizationId, input.userId);
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
