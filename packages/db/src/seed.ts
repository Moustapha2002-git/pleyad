/**
 * Seed — installs Innovation Academy as organization #1 (the flagship tenant,
 * "Powered by Pleyad"). Idempotent: safe to run repeatedly.
 *
 * Run with:  pnpm db:seed   (after DATABASE_URL is set and migrations applied)
 */
import { eq } from "drizzle-orm";
import { db } from "./client";
import { organizations } from "./schema";

const INNOVATION_ACADEMY = {
  slug: "innovation-academy",
  name: "Innovation Academy",
  type: "team" as const,
  logoUrl: "https://innovationacademy.ac/logo.png",
  primaryColor: "#0A2540", // navy
  accentColor: "#C9A227", // gold
  brandingEnabled: true,
  plan: "enterprise",
};

async function seed() {
  const existing = await db
    .select()
    .from(organizations)
    .where(eq(organizations.slug, INNOVATION_ACADEMY.slug));

  if (existing.length > 0) {
    console.log(`✓ '${INNOVATION_ACADEMY.slug}' already exists (id=${existing[0]!.id}). Nothing to do.`);
    return;
  }

  await db.insert(organizations).values(INNOVATION_ACADEMY);
  const [created] = await db
    .select()
    .from(organizations)
    .where(eq(organizations.slug, INNOVATION_ACADEMY.slug));

  console.log(`✓ Seeded Innovation Academy as organization #${created!.id} (${created!.publicId}).`);
}

seed()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error("Seed failed:", err);
    process.exit(1);
  });
