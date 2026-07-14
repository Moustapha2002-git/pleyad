import { z } from "zod";
import { db, messagesRepo, notificationsRepo } from "@pleyad/db";
import { router, tenantProcedure } from "../trpc";

export const messagesRouter = router({
  thread: tenantProcedure
    .input(z.object({ withUserId: z.number() }))
    .query(({ ctx, input }) =>
      messagesRepo.getThread(db, ctx.tenant.organizationId, ctx.tenant.userId, input.withUserId),
    ),

  send: tenantProcedure
    .input(z.object({ toUserId: z.number(), body: z.string().min(1) }))
    .mutation(async ({ ctx, input }) => {
      await messagesRepo.sendMessage(db, {
        organizationId: ctx.tenant.organizationId,
        senderUserId: ctx.tenant.userId,
        recipientUserId: input.toUserId,
        body: input.body,
      });
      await notificationsRepo.notify(db, {
        organizationId: ctx.tenant.organizationId,
        userId: input.toUserId,
        type: "message",
        title: `New message from ${ctx.user.name ?? ctx.user.email ?? "someone"}`,
        body: input.body.slice(0, 140),
      });
      return { success: true };
    }),

  /** Mark the thread with `withUserId` as read (clears unread badges). */
  markRead: tenantProcedure
    .input(z.object({ withUserId: z.number() }))
    .mutation(async ({ ctx, input }) => {
      await messagesRepo.markThreadRead(
        db,
        ctx.tenant.organizationId,
        ctx.tenant.userId,
        input.withUserId,
      );
      return { success: true };
    }),
});
