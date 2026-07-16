import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { db, invitesRepo, organizationsRepo } from "@pleyad/db";
import { setActiveOrgCookie } from "../auth/cookies";
import { protectedProcedure, publicProcedure, router } from "../trpc";

const ROLE_LABEL: Record<string, string> = {
  member: "Learner",
  mentor: "Mentor",
  admin: "Admin",
};

export const invitesRouter = router({
  /** What an invite link points at — shown on the register page before signup. */
  info: publicProcedure.input(z.object({ token: z.string().min(1) })).query(async ({ input }) => {
    const hit = await invitesRepo.getValidInviteByToken(db, input.token);
    if (!hit) return null;
    return {
      organizationName: hit.organization.name,
      role: hit.invite.role,
      roleLabel: ROLE_LABEL[hit.invite.role] ?? hit.invite.role,
    };
  }),

  /** A signed-in user accepts an invite → joins the workspace and switches to it. */
  accept: protectedProcedure
    .input(z.object({ token: z.string().min(1) }))
    .mutation(async ({ ctx, input }) => {
      const hit = await invitesRepo.getValidInviteByToken(db, input.token);
      if (!hit) {
        throw new TRPCError({ code: "NOT_FOUND", message: "This invite link is no longer valid" });
      }
      await organizationsRepo.joinOrganization(
        db,
        ctx.user.id,
        hit.organization.id,
        hit.invite.role,
      );
      await invitesRepo.bumpInviteUse(db, hit.invite.id);
      setActiveOrgCookie(ctx.res, hit.organization.publicId);
      return { organizationName: hit.organization.name };
    }),
});
