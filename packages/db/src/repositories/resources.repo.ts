import { and, eq } from "drizzle-orm";
import type { DB } from "../client";
import { learningResources } from "../schema";
import type { InsertLearningResource } from "../schema";
import type { TenantContext } from "./context";

/**
 * Resource ingestion.
 *
 * EXTERNAL resources are the shared canonical catalog: deduped globally by
 * (platform, external_id) so two learners — or two organizations — referencing
 * the same Coursera course resolve to the SAME row. This exact-match identity is
 * what lets org completion be derived by matching assigned resources to a
 * member's activities, with zero fuzzy string matching.
 *
 * NATIVE resources (Phase 2 hosting) are org-owned/private and always scoped to
 * an organization.
 */

type ExternalInput = {
  platform: NonNullable<InsertLearningResource["platform"]>;
  externalId: string;
  url: string;
  title: string;
  description?: string;
  thumbnailUrl?: string;
  provider?: string;
  durationSeconds?: number;
};

/**
 * Upsert an external resource into the global catalog. Not tenant-scoped: the
 * external catalog is shared across the whole platform by design. Takes the raw
 * `DB` handle rather than a `TenantContext` to make that global scope explicit.
 */
export async function upsertExternalResource(db: DB, input: ExternalInput) {
  const existing = await db
    .select()
    .from(learningResources)
    .where(
      and(
        eq(learningResources.platform, input.platform),
        eq(learningResources.externalId, input.externalId),
      ),
    );

  if (existing[0]) return existing[0];

  await db.insert(learningResources).values({
    sourceType: "external",
    ownerOrganizationId: null,
    platform: input.platform,
    externalId: input.externalId,
    url: input.url,
    title: input.title,
    description: input.description ?? null,
    thumbnailUrl: input.thumbnailUrl ?? null,
    provider: input.provider ?? null,
    durationSeconds: input.durationSeconds ?? null,
  });

  const [row] = await db
    .select()
    .from(learningResources)
    .where(
      and(
        eq(learningResources.platform, input.platform),
        eq(learningResources.externalId, input.externalId),
      ),
    );
  return row!;
}

/** Read a native (org-owned) resource, scoped to the tenant that owns it. */
export async function getNativeResource(ctx: TenantContext, id: number) {
  const rows = await ctx.db
    .select()
    .from(learningResources)
    .where(
      and(
        eq(learningResources.id, id),
        eq(learningResources.ownerOrganizationId, ctx.organizationId),
      ),
    );
  return rows[0] ?? null;
}
