import { db, notificationsRepo } from "@pleyad/db";
import { router, tenantProcedure } from "../trpc";

export const notificationsRouter = router({
  /** The current user's recent notifications in this workspace. */
  list: tenantProcedure.query(({ ctx }) =>
    notificationsRepo.listForUser(db, ctx.tenant.organizationId, ctx.tenant.userId),
  ),

  /** Unread count — polled for the bell badge. */
  unreadCount: tenantProcedure.query(({ ctx }) =>
    notificationsRepo.unreadCount(db, ctx.tenant.organizationId, ctx.tenant.userId),
  ),

  markAllRead: tenantProcedure.mutation(async ({ ctx }) => {
    await notificationsRepo.markAllRead(db, ctx.tenant.organizationId, ctx.tenant.userId);
    return { ok: true };
  }),
});
