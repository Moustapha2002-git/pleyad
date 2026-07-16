import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { db, invitesRepo, organizationsRepo, usersRepo } from "@pleyad/db";
import { clearSessionCookie, setActiveOrgCookie, setSessionCookie } from "../auth/cookies";
import { hashPassword, verifyPassword } from "../auth/password";
import { createSessionToken } from "../auth/session";
import { protectedProcedure, publicProcedure, router } from "../trpc";

export const authRouter = router({
  /** Current user + active workspace, or null if signed out. */
  me: publicProcedure.query(({ ctx }) => {
    if (!ctx.user) return null;
    return {
      id: ctx.user.id,
      publicId: ctx.user.publicId,
      email: ctx.user.email,
      name: ctx.user.name,
      activeOrganization: ctx.tenant
        ? {
            id: ctx.tenant.organizationId,
            publicId: ctx.tenant.organizationPublicId,
            name: ctx.tenant.organizationName,
            type: ctx.tenant.organizationType,
            role: ctx.tenant.role,
          }
        : null,
    };
  }),

  register: publicProcedure
    .input(
      z.object({
        name: z.string().min(2, "Name must be at least 2 characters"),
        email: z.string().email(),
        password: z.string().min(8, "Password must be at least 8 characters"),
        inviteToken: z.string().optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      // Validate the invite BEFORE creating anything, so a dead link fails cleanly.
      const invite = input.inviteToken
        ? await invitesRepo.getValidInviteByToken(db, input.inviteToken)
        : null;
      if (input.inviteToken && !invite) {
        throw new TRPCError({ code: "NOT_FOUND", message: "This invite link is no longer valid" });
      }

      const existing = await usersRepo.getUserByEmail(db, input.email);
      if (existing) {
        throw new TRPCError({ code: "CONFLICT", message: "Email already registered" });
      }
      const passwordHash = await hashPassword(input.password);
      const user = await usersRepo.createUser(db, {
        email: input.email,
        name: input.name,
        passwordHash,
      });
      // Every new user gets a personal workspace (type=personal, owner membership).
      await organizationsRepo.createPersonalWorkspace(db, user);

      // Invited signups also join the inviting workspace and land there directly.
      if (invite) {
        await organizationsRepo.joinOrganization(
          db,
          user.id,
          invite.organization.id,
          invite.invite.role,
        );
        await invitesRepo.bumpInviteUse(db, invite.invite.id);
        setActiveOrgCookie(ctx.res, invite.organization.publicId);
      }

      const token = await createSessionToken(user.id);
      setSessionCookie(ctx.res, token);
      return { success: true, joinedOrganization: invite?.organization.name ?? null };
    }),

  login: publicProcedure
    .input(z.object({ email: z.string().email(), password: z.string().min(1) }))
    .mutation(async ({ ctx, input }) => {
      const user = await usersRepo.getUserByEmail(db, input.email);
      if (!user?.passwordHash || !(await verifyPassword(input.password, user.passwordHash))) {
        throw new TRPCError({ code: "UNAUTHORIZED", message: "Invalid email or password" });
      }
      await usersRepo.setLastSignedIn(db, user.id);
      const token = await createSessionToken(user.id);
      setSessionCookie(ctx.res, token);
      return { success: true };
    }),

  logout: protectedProcedure.mutation(({ ctx }) => {
    clearSessionCookie(ctx.res);
    return { success: true };
  }),

  /** Update the signed-in user's display name. */
  updateProfile: protectedProcedure
    .input(z.object({ name: z.string().min(2, "Name must be at least 2 characters") }))
    .mutation(async ({ ctx, input }) => {
      await usersRepo.updateProfile(db, ctx.user.id, { name: input.name.trim() });
      return { success: true };
    }),

  /** Change the signed-in user's password (verifies the current one first). */
  changePassword: protectedProcedure
    .input(
      z.object({
        currentPassword: z.string().min(1),
        newPassword: z.string().min(8, "Password must be at least 8 characters"),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const user = await usersRepo.getUserById(db, ctx.user.id);
      if (
        !user?.passwordHash ||
        !(await verifyPassword(input.currentPassword, user.passwordHash))
      ) {
        throw new TRPCError({ code: "UNAUTHORIZED", message: "Current password is incorrect" });
      }
      await usersRepo.setPassword(db, ctx.user.id, await hashPassword(input.newPassword));
      return { success: true };
    }),
});
