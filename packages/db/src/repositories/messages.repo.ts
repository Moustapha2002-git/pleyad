import { and, eq, isNull, or } from "drizzle-orm";
import type { DB } from "../client";
import { messages } from "../schema";

/**
 * Simple 1:1 messaging within an organization. A thread is all messages between
 * two users in that org, ordered oldest → newest.
 */

export async function getThread(
  db: DB,
  organizationId: number,
  userA: number,
  userB: number,
) {
  return db
    .select()
    .from(messages)
    .where(
      and(
        eq(messages.organizationId, organizationId),
        or(
          and(eq(messages.senderUserId, userA), eq(messages.recipientUserId, userB)),
          and(eq(messages.senderUserId, userB), eq(messages.recipientUserId, userA)),
        ),
      ),
    )
    .orderBy(messages.createdAt);
}

export async function sendMessage(
  db: DB,
  input: {
    organizationId: number;
    senderUserId: number;
    recipientUserId: number;
    body: string;
  },
) {
  const [res] = await db.insert(messages).values(input);
  return res.insertId;
}

/** Mark every message from `fromUserId` to `toUserId` in this org as read. */
export async function markThreadRead(
  db: DB,
  organizationId: number,
  toUserId: number,
  fromUserId: number,
) {
  await db
    .update(messages)
    .set({ readAt: new Date() })
    .where(
      and(
        eq(messages.organizationId, organizationId),
        eq(messages.recipientUserId, toUserId),
        eq(messages.senderUserId, fromUserId),
        isNull(messages.readAt),
      ),
    );
}
