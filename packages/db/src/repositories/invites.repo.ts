import { and, desc, eq, isNull, sql } from "drizzle-orm";
import type { DB } from "../client";
import { invitations, organizations } from "../schema";

/**
 * Reusable join links. A link is valid while not revoked; each successful join
 * bumps usedCount. Lookups by token join the organization so the register page
 * can show "join <org> as <role>" before any account exists.
 */

export async function createInvite(
  db: DB,
  organizationId: number,
  role: "member" | "mentor" | "admin",
  createdByUserId: number,
) {
  await db.insert(invitations).values({ organizationId, role, createdByUserId });
  const rows = await db
    .select()
    .from(invitations)
    .where(and(eq(invitations.organizationId, organizationId), isNull(invitations.revokedAt)))
    .orderBy(desc(invitations.id))
    .limit(1);
  return rows[0]!;
}

/** Active (non-revoked) invites for an organization. */
export async function listActiveInvites(db: DB, organizationId: number) {
  return db
    .select()
    .from(invitations)
    .where(and(eq(invitations.organizationId, organizationId), isNull(invitations.revokedAt)))
    .orderBy(desc(invitations.createdAt));
}

export async function revokeInvite(db: DB, organizationId: number, inviteId: number) {
  await db
    .update(invitations)
    .set({ revokedAt: new Date() })
    .where(and(eq(invitations.id, inviteId), eq(invitations.organizationId, organizationId)));
}

/** A valid (non-revoked) invite by token, with its organization. Null if invalid. */
export async function getValidInviteByToken(db: DB, token: string) {
  const rows = await db
    .select({ invite: invitations, organization: organizations })
    .from(invitations)
    .innerJoin(organizations, eq(invitations.organizationId, organizations.id))
    .where(and(eq(invitations.token, token), isNull(invitations.revokedAt)));
  return rows[0] ?? null;
}

export async function bumpInviteUse(db: DB, inviteId: number) {
  await db
    .update(invitations)
    .set({ usedCount: sql`${invitations.usedCount} + 1` })
    .where(eq(invitations.id, inviteId));
}
