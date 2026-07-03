import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { db, organizationsRepo } from "@pleyad/db";
import { setActiveOrgCookie } from "../auth/cookies";
import { protectedProcedure, router } from "../trpc";

export const orgRouter = router({
  /** All workspaces the user belongs to (for the workspace switcher). */
  myWorkspaces: protectedProcedure.query(async ({ ctx }) => {
    const memberships = await organizationsRepo.getUserMemberships(db, ctx.user.id);
    return memberships.map((m) => ({
      id: m.organization.id,
      publicId: m.organization.publicId,
      name: m.organization.name,
      type: m.organization.type,
      role: m.membership.role,
    }));
  }),

  /** Switch the active workspace (sets the org cookie the context reads). */
  switchWorkspace: protectedProcedure
    .input(z.object({ organizationPublicId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const memberships = await organizationsRepo.getUserMemberships(db, ctx.user.id);
      const target = memberships.find(
        (m) => m.organization.publicId === input.organizationPublicId,
      );
      if (!target) throw new TRPCError({ code: "FORBIDDEN", message: "Not a member" });
      setActiveOrgCookie(ctx.res, input.organizationPublicId);
      return { success: true };
    }),
});
