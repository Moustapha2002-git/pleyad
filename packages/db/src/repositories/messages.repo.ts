import { and, eq, or } from "drizzle-orm";
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
