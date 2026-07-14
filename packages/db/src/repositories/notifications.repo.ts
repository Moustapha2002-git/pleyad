import { and, desc, eq, isNull } from "drizzle-orm";
import type { DB } from "../client";
import { notifications } from "../schema";
import type { NotificationType } from "../schema";

/**
 * In-app notifications. Fire-and-forget on write (a failed notification must never
 * break the action that triggered it); read paths are scoped to (org, recipient).
 */

export async function notify(
  db: DB,
  input: {
    organizationId: number;
    userId: number;
    type: NotificationType;
    title: string;
    body?: string | null;
    linkTo?: string | null;
  },
) {
  try {
    await db.insert(notifications).values({
      organizationId: input.organizationId,
      userId: input.userId,
      type: input.type,
      title: input.title,
      body: input.body ?? null,
      linkTo: input.linkTo ?? null,
    });
  } catch {
    // Notifications are best-effort — never surface a failure to the caller.
  }
}

/** Most recent notifications for a recipient in a workspace. */
export async function listForUser(
  db: DB,
  organizationId: number,
  userId: number,
  limit = 20,
) {
  return db
    .select()
    .from(notifications)
    .where(
      and(eq(notifications.organizationId, organizationId), eq(notifications.userId, userId)),
    )
    .orderBy(desc(notifications.createdAt))
    .limit(limit);
}

export async function unreadCount(db: DB, organizationId: number, userId: number) {
  const rows = await db
    .select({ id: notifications.id })
    .from(notifications)
    .where(
      and(
        eq(notifications.organizationId, organizationId),
        eq(notifications.userId, userId),
        isNull(notifications.readAt),
      ),
    );
  return rows.length;
}

export async function markAllRead(db: DB, organizationId: number, userId: number) {
  await db
    .update(notifications)
    .set({ readAt: new Date() })
    .where(
      and(
        eq(notifications.organizationId, organizationId),
        eq(notifications.userId, userId),
        isNull(notifications.readAt),
      ),
    );
}
