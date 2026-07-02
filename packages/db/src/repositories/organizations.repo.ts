import { and, eq } from "drizzle-orm";
import type { DB } from "../client";
import { memberships, organizations } from "../schema";
import type { User } from "../schema";

/**
 * Organization + membership access. Reads here are keyed by user identity (to
 * discover which workspaces a user belongs to) rather than by an already-resolved
 * tenant — this is the layer that *establishes* tenant context, so it necessarily
 * runs before a TenantContext exists.
 */

/**
 * Creates a user's personal workspace: a `type=personal` organization plus an
 * `owner` membership. Called on registration so every user always has a home tenant.
 */
export async function createPersonalWorkspace(db: DB, user: User) {
  const slug = `personal-${user.publicId.toLowerCase()}`;
  await db.insert(organizations).values({
    slug,
    name: user.name ? `${user.name}'s Space` : "Personal Space",
    type: "personal",
    plan: "free",
  });
  const [org] = await db.select().from(organizations).where(eq(organizations.slug, slug));
  if (!org) throw new Error("Failed to create personal workspace");

  await db.insert(memberships).values({
    userId: user.id,
    organizationId: org.id,
    role: "owner",
    status: "active",
  });
  return org;
}

/** All active memberships for a user, joined to their organizations. */
export async function getUserMemberships(db: DB, userId: number) {
  return db
    .select({ membership: memberships, organization: organizations })
    .from(memberships)
    .innerJoin(organizations, eq(memberships.organizationId, organizations.id))
    .where(eq(memberships.userId, userId));
}

/** A single membership, used to authorize a user against a specific organization. */
export async function getMembership(db: DB, userId: number, organizationId: number) {
  const rows = await db
    .select()
    .from(memberships)
    .where(and(eq(memberships.userId, userId), eq(memberships.organizationId, organizationId)));
  return rows[0] ?? null;
}
