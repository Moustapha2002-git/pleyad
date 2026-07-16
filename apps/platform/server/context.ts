import type { CreateExpressContextOptions } from "@trpc/server/adapters/express";
import { parse as parseCookie } from "cookie";
import { db, organizationsRepo, usersRepo } from "@pleyad/db";
import { ACTIVE_ORG_COOKIE, SESSION_COOKIE } from "./auth/cookies";
import { verifySessionToken } from "./auth/session";

type Role = "owner" | "admin" | "manager" | "mentor" | "member";

/**
 * Builds the per-request context. This is where a session cookie becomes a
 * (user, organization, role) triple — resolved entirely server-side. The active
 * organization is chosen from: an explicit workspace cookie (validated against the
 * user's memberships) → the user's personal workspace → their first membership.
 */
export async function createContext({ req, res }: CreateExpressContextOptions) {
  const cookies = parseCookie(req.headers.cookie ?? "");
  const token = cookies[SESSION_COOKIE];

  let user = null;
  if (token) {
    const uid = await verifySessionToken(token);
    if (uid) user = await usersRepo.getUserById(db, uid);
  }

  let tenant: {
    organizationId: number;
    organizationPublicId: string;
    organizationName: string;
    organizationType: "personal" | "team";
    role: Role;
    branding: { logoUrl: string | null; primaryColor: string | null } | null;
  } | null = null;
  if (user) {
    const memberships = await organizationsRepo.getUserMemberships(db, user.id);
    if (memberships.length > 0) {
      const activeOrgPublicId = cookies[ACTIVE_ORG_COOKIE];
      const chosen =
        (activeOrgPublicId
          ? memberships.find((m) => m.organization.publicId === activeOrgPublicId)
          : undefined) ??
        memberships.find((m) => m.organization.type === "personal") ??
        memberships[0];
      if (chosen) {
        tenant = {
          organizationId: chosen.organization.id,
          organizationPublicId: chosen.organization.publicId,
          organizationName: chosen.organization.name,
          organizationType: chosen.organization.type,
          role: chosen.membership.role,
          branding: chosen.organization.brandingEnabled
            ? {
                logoUrl: chosen.organization.logoUrl,
                primaryColor: chosen.organization.primaryColor,
              }
            : null,
        };
      }
    }
  }

  return { db, req, res, user, tenant };
}

export type Context = Awaited<ReturnType<typeof createContext>>;
