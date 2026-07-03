import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { db, organizationsRepo, usersRepo } from "@pleyad/db";
import { clearSessionCookie, setSessionCookie } from "../auth/cookies";
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
      }),
    )
    .mutation(async ({ ctx, input }) => {
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

      const token = await createSessionToken(user.id);
      setSessionCookie(ctx.res, token);
      return { success: true };
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
});
