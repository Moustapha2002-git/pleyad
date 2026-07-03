import type { Response } from "express";

export const SESSION_COOKIE = "pleyad_session";
export const ACTIVE_ORG_COOKIE = "pleyad_org";

const THIRTY_DAYS_MS = 30 * 24 * 60 * 60 * 1000;

export function setSessionCookie(res: Response, token: string) {
  res.cookie(SESSION_COOKIE, token, {
    httpOnly: true,
    // `secure` must be false over plain http in local dev, true in production.
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: THIRTY_DAYS_MS,
    path: "/",
  });
}

export function clearSessionCookie(res: Response) {
  res.clearCookie(SESSION_COOKIE, { path: "/" });
}

/** Remembers which workspace (organization) the user is currently viewing. */
export function setActiveOrgCookie(res: Response, organizationPublicId: string) {
  res.cookie(ACTIVE_ORG_COOKIE, organizationPublicId, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: THIRTY_DAYS_MS,
    path: "/",
  });
}
