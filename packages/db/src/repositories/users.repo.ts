import { eq } from "drizzle-orm";
import type { DB } from "../client";
import { users } from "../schema";

/**
 * User identity access. NOT tenant-scoped — users are global identities, so these
 * take the raw DB handle rather than a TenantContext.
 */

export async function getUserByEmail(db: DB, email: string) {
  const rows = await db.select().from(users).where(eq(users.email, email));
  return rows[0] ?? null;
}

export async function getUserById(db: DB, id: number) {
  const rows = await db.select().from(users).where(eq(users.id, id));
  return rows[0] ?? null;
}

export async function createUser(
  db: DB,
  input: { email: string; name: string; passwordHash: string },
) {
  await db.insert(users).values({
    email: input.email,
    name: input.name,
    passwordHash: input.passwordHash,
  });
  const created = await getUserByEmail(db, input.email);
  if (!created) throw new Error("Failed to create user");
  return created;
}

export async function setLastSignedIn(db: DB, id: number) {
  await db.update(users).set({ lastSignedInAt: new Date() }).where(eq(users.id, id));
}

/** Update the user's editable profile fields (name, avatar). */
export async function updateProfile(
  db: DB,
  id: number,
  input: { name?: string; avatarUrl?: string | null },
) {
  await db.update(users).set(input).where(eq(users.id, id));
}

export async function setPassword(db: DB, id: number, passwordHash: string) {
  await db.update(users).set({ passwordHash }).where(eq(users.id, id));
}

// ── Mentor profile (headline/bio/expertise/languages/availability) ───────

export type MentorProfile = {
  headline: string | null;
  bio: string | null;
  expertise: string[];
  languages: string[];
  availabilityNote: string | null;
};

function parseTags(json: string | null): string[] {
  if (!json) return [];
  try {
    const v = JSON.parse(json);
    return Array.isArray(v) ? v.filter((x): x is string => typeof x === "string") : [];
  } catch {
    return [];
  }
}

/** Profile fields from a users row (JSON columns parsed). */
export function toMentorProfile(u: {
  headline: string | null;
  bio: string | null;
  expertiseJson: string | null;
  languagesJson: string | null;
  availabilityNote: string | null;
}): MentorProfile {
  return {
    headline: u.headline,
    bio: u.bio,
    expertise: parseTags(u.expertiseJson),
    languages: parseTags(u.languagesJson),
    availabilityNote: u.availabilityNote,
  };
}

export async function updateMentorProfile(
  db: DB,
  id: number,
  input: {
    headline: string | null;
    bio: string | null;
    expertise: string[];
    languages: string[];
    availabilityNote: string | null;
  },
) {
  await db
    .update(users)
    .set({
      headline: input.headline,
      bio: input.bio,
      expertiseJson: JSON.stringify(input.expertise),
      languagesJson: JSON.stringify(input.languages),
      availabilityNote: input.availabilityNote,
    })
    .where(eq(users.id, id));
}
