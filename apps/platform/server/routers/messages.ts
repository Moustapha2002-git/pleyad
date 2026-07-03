import { z } from "zod";
import { db, messagesRepo } from "@pleyad/db";
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
      return { success: true };
    }),
});
