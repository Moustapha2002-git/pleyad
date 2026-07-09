import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { router, tenantProcedure } from "../trpc";
import * as calls from "../calls";
import { getJoinUrl } from "../daily";

export const callsRouter = router({
  /**
   * A private, token-secured join URL for a room. The room name embeds the
   * workspace's unguessable public id, so only the two intended participants
   * ever know it; the token then locks entry to this authenticated user.
   */
  dailyUrl: tenantProcedure
    .input(z.object({ room: z.string().min(1) }))
    .query(async ({ ctx, input }) => {
      if (!input.room.startsWith("pleyad-")) {
        throw new TRPCError({ code: "BAD_REQUEST" });
      }
      const userName = ctx.user.name ?? ctx.user.email ?? "Guest";
      const url = await getJoinUrl(input.room, userName);
      return { url }; // null when Daily isn't configured -> client falls back to Jitsi
    }),

  /** Caller signals an incoming call to the callee (room is computed client-side). */
  ring: tenantProcedure
    .input(z.object({ toUserId: z.number(), room: z.string().min(1) }))
    .mutation(({ ctx, input }) => {
      calls.ring({
        fromUserId: ctx.tenant.userId,
        fromName: ctx.user.name ?? ctx.user.email ?? "Someone",
        toUserId: input.toUserId,
        organizationId: ctx.tenant.organizationId,
        room: input.room,
      });
      return { ok: true };
    }),

  /** Polled by every client to detect an incoming call in the active workspace. */
  incoming: tenantProcedure.query(({ ctx }) => {
    const inv = calls.getIncoming(ctx.tenant.userId, ctx.tenant.organizationId);
    return inv ? { room: inv.room, fromName: inv.fromName } : null;
  }),

  answer: tenantProcedure.mutation(({ ctx }) => {
    calls.clearIncoming(ctx.tenant.userId);
    return { ok: true };
  }),

  decline: tenantProcedure.mutation(({ ctx }) => {
    calls.clearIncoming(ctx.tenant.userId);
    return { ok: true };
  }),

  /** Caller withdraws a ring (e.g. they closed the call before it was answered). */
  cancel: tenantProcedure
    .input(z.object({ toUserId: z.number() }))
    .mutation(({ ctx, input }) => {
      calls.cancelFrom(ctx.tenant.userId, input.toUserId);
      return { ok: true };
    }),
});
