import { and, eq } from "drizzle-orm";
import type { DB } from "../client";
import { memberships, organizations, users } from "../schema";
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

export async function getOrganizationBySlug(db: DB, slug: string) {
  const rows = await db.select().from(organizations).where(eq(organizations.slug, slug));
  return rows[0] ?? null;
}

type Role = "owner" | "admin" | "manager" | "mentor" | "member";

/** Idempotently add a user to an organization with a role. */
export async function joinOrganization(
  db: DB,
  userId: number,
  organizationId: number,
  role: Role = "member",
) {
  const existing = await getMembership(db, userId, organizationId);
  if (existing) return existing;
  await db.insert(memberships).values({ userId, organizationId, role, status: "active" });
  const created = await getMembership(db, userId, organizationId);
  if (!created) throw new Error("Failed to create membership");
  return created;
}

export async function setMembershipRole(
  db: DB,
  userId: number,
  organizationId: number,
  role: Role,
) {
  await db
    .update(memberships)
    .set({ role })
    .where(and(eq(memberships.userId, userId), eq(memberships.organizationId, organizationId)));
}

/** Rename an organization (admin console → workspace settings). */
export async function renameOrganization(db: DB, organizationId: number, name: string) {
  await db.update(organizations).set({ name }).where(eq(organizations.id, organizationId));
}

/** All members of an organization (for the admin console). */
export async function getOrganizationMembers(db: DB, organizationId: number) {
  return db
    .select({
      userId: users.id,
      name: users.name,
      email: users.email,
      role: memberships.role,
      status: memberships.status,
    })
    .from(memberships)
    .innerJoin(users, eq(memberships.userId, users.id))
    .where(eq(memberships.organizationId, organizationId));
}
