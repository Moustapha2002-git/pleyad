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
