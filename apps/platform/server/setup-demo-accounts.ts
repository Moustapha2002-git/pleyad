/**
 * Seeds clean, memorable demo accounts (all password "demo1234") in Innovation
 * Academy for testing the live site. Idempotent. Ensures Ahmed & Fatima are
 * mentored by exactly Sara (removing any stale assignments) so the pairing is clean.
 *
 * Run:  npx tsx server/setup-demo-accounts.ts
 */
import "dotenv/config";
import { db, mentorshipRepo, organizationsRepo, pathsRepo, usersRepo } from "@pleyad/db";
import { hashPassword } from "./auth/password";

const PW = "demo1234";

async function ensureUser(name: string, email: string) {
  const found = await usersRepo.getUserByEmail(db, email);
  const hash = await hashPassword(PW);
  if (found) {
    await usersRepo.setPassword(db, found.id, hash); // reset to known password
    return found;
  }
  return usersRepo.createUser(db, { name, email, passwordHash: hash });
}

async function main() {
  const ia = await organizationsRepo.getOrganizationBySlug(db, "innovation-academy");
  if (!ia) throw new Error("Innovation Academy not seeded");

  // Mentor "Sara", admin, and two learners.
  const sara = await ensureUser("Sara Mentor", "sara@demo.pleyad.test");
  await organizationsRepo.joinOrganization(db, sara.id, ia.id, "mentor");
  await organizationsRepo.setMembershipRole(db, sara.id, ia.id, "mentor");

  const admin = await ensureUser("Admin Demo", "admin@demo.pleyad.test");
  await organizationsRepo.joinOrganization(db, admin.id, ia.id, "admin");
  await organizationsRepo.setMembershipRole(db, admin.id, ia.id, "admin");

  const ahmed = await ensureUser("Ahmed Diallo", "ahmed.learner@demo.pleyad.test");
  const fatima = await ensureUser("Fatima Sy", "fatima.learner@demo.pleyad.test");

  for (const l of [ahmed, fatima]) {
    await organizationsRepo.joinOrganization(db, l.id, ia.id, "member");
    // Clean any stale mentor links, then assign Sara as the sole mentor.
    const current = await mentorshipRepo.getMentorsForLearner(db, ia.id, l.id);
    for (const m of current) await mentorshipRepo.unassignLearner(db, ia.id, m.id, l.id);
    await mentorshipRepo.assignLearner(db, ia.id, sara.id, l.id);
  }

  // Make sure both learners have the org paths assigned.
  const orgPaths = await pathsRepo.listPathsForUser(db, ia.id, sara.id);
  for (const l of [ahmed, fatima]) {
    for (const op of orgPaths) {
      await pathsRepo.assignPath(db, ia.id, op.id, l.id, sara.id, null);
    }
  }

  console.log("✓ Demo accounts ready (Innovation Academy), password = demo1234:");
  console.log("  sara@demo.pleyad.test           (Mentor — mentors Ahmed & Fatima)");
  console.log("  ahmed.learner@demo.pleyad.test  (Learner)");
  console.log("  fatima.learner@demo.pleyad.test (Learner, at-risk)");
  console.log("  admin@demo.pleyad.test          (Admin — analytics + members)");
  console.log(`  org paths assigned: ${orgPaths.length}`);
  process.exit(0);
}

main().catch((e) => {
  console.error("SETUP FAILED:", e);
  process.exit(1);
});
