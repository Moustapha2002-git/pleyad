/**
 * Promotes an existing user to owner/admin of an organization. Production-safe
 * bootstrap for the FIRST admin (the in-app admin console handles everyone after).
 *
 * Usage: pnpm -C packages/db exec tsx src/make-admin.ts <email> [orgSlug]
 *   e.g. pnpm -C packages/db exec tsx src/make-admin.ts me@example.com innovation-academy
 */
import "dotenv/config";
import { db } from "./client";
import * as organizationsRepo from "./repositories/organizations.repo";
import * as usersRepo from "./repositories/users.repo";

const email = process.argv[2];
const slug = process.argv[3] ?? "innovation-academy";

if (!email) {
  console.error("Usage: db:make-admin -- <email> [orgSlug]");
  process.exit(1);
}

const org = await organizationsRepo.getOrganizationBySlug(db, slug);
if (!org) {
  console.error(`Organization '${slug}' not found.`);
  process.exit(1);
}

const user = await usersRepo.getUserByEmail(db, email);
if (!user) {
  console.error(`No user with email '${email}'. Ask them to register first, then re-run.`);
  process.exit(1);
}

await organizationsRepo.joinOrganization(db, user.id, org.id, "owner");
await organizationsRepo.setMembershipRole(db, user.id, org.id, "owner");
console.log(`✓ ${email} is now an owner/admin of ${org.name}.`);
process.exit(0);
