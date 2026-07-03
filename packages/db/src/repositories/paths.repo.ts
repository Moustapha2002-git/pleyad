import { and, eq, inArray } from "drizzle-orm";
import { nanoid } from "nanoid";
import type { DB } from "../client";
import {
  collectionDimensions,
  collectionItems,
  collections,
  learningResources,
  userActivities,
} from "../schema";
import type { Dimension, InsertLearningResource } from "../schema";
import type { TenantContext } from "./context";

type PlatformType = NonNullable<InsertLearningResource["platform"]>;

/**
 * Learning paths = collections with kind="path", tagged with 1–3 dimensions.
 * Progress and the per-dimension gauges are DERIVED from user_activities — there
 * are no stored counters to keep in sync.
 */

export async function createPath(
  ctx: TenantContext,
  input: { title: string; description?: string; dimensions: Dimension[] },
) {
  const [res] = await ctx.db.insert(collections).values({
    organizationId: ctx.organizationId,
    ownerUserId: ctx.userId,
    kind: "path",
    title: input.title,
    description: input.description ?? null,
  });
  const pathId = res.insertId;
  if (input.dimensions.length > 0) {
    await ctx.db
      .insert(collectionDimensions)
      .values(input.dimensions.map((dimension) => ({ collectionId: pathId, dimension })));
  }
  return pathId;
}

export async function listPathsForUser(db: DB, organizationId: number, userId: number) {
  const paths = await db
    .select()
    .from(collections)
    .where(and(eq(collections.organizationId, organizationId), eq(collections.kind, "path")));
  if (paths.length === 0) return [];

  const pathIds = paths.map((p) => p.id);
  const dims = await db
    .select()
    .from(collectionDimensions)
    .where(inArray(collectionDimensions.collectionId, pathIds));
  const items = await db
    .select()
    .from(collectionItems)
    .where(inArray(collectionItems.collectionId, pathIds));

  const resourceIds = items.map((i) => i.resourceId);
  const acts = resourceIds.length
    ? await db
        .select()
        .from(userActivities)
        .where(
          and(eq(userActivities.userId, userId), inArray(userActivities.resourceId, resourceIds)),
        )
    : [];
  const doneResourceIds = new Set(
    acts.filter((a) => a.status === "completed").map((a) => a.resourceId),
  );

  return paths.map((p) => {
    const pItems = items.filter((i) => i.collectionId === p.id);
    const total = pItems.length;
    const completed = pItems.filter((i) => doneResourceIds.has(i.resourceId)).length;
    return {
      id: p.id,
      publicId: p.publicId,
      title: p.title,
      description: p.description,
      dimensions: dims.filter((d) => d.collectionId === p.id).map((d) => d.dimension),
      itemCount: total,
      completedCount: completed,
      progress: total > 0 ? Math.round((completed / total) * 100) : 0,
    };
  });
}

export async function listPaths(ctx: TenantContext) {
  return listPathsForUser(ctx.db, ctx.organizationId, ctx.userId);
}

export async function getPath(ctx: TenantContext, id: number) {
  const rows = await ctx.db
    .select()
    .from(collections)
    .where(and(eq(collections.id, id), eq(collections.organizationId, ctx.organizationId)));
  const path = rows[0];
  if (!path) return null;

  const dims = (
    await ctx.db
      .select()
      .from(collectionDimensions)
      .where(eq(collectionDimensions.collectionId, id))
  ).map((d) => d.dimension);

  const joined = await ctx.db
    .select({ item: collectionItems, resource: learningResources })
    .from(collectionItems)
    .innerJoin(learningResources, eq(collectionItems.resourceId, learningResources.id))
    .where(eq(collectionItems.collectionId, id))
    .orderBy(collectionItems.position);

  const resourceIds = joined.map((r) => r.resource.id);
  const acts = resourceIds.length
    ? await ctx.db
        .select()
        .from(userActivities)
        .where(
          and(
            eq(userActivities.userId, ctx.userId),
            inArray(userActivities.resourceId, resourceIds),
          ),
        )
    : [];
  const doneSet = new Set(
    acts.filter((a) => a.status === "completed").map((a) => a.resourceId),
  );

  const items = joined.map((r) => ({
    itemId: r.item.id,
    resourceId: r.resource.id,
    title: r.resource.title,
    platform: r.resource.platform,
    url: r.resource.url,
    done: doneSet.has(r.resource.id),
  }));
  const completed = items.filter((i) => i.done).length;

  return {
    id: path.id,
    publicId: path.publicId,
    title: path.title,
    description: path.description,
    dimensions: dims,
    items,
    itemCount: items.length,
    completedCount: completed,
    progress: items.length > 0 ? Math.round((completed / items.length) * 100) : 0,
  };
}

export async function addItemToPath(
  ctx: TenantContext,
  pathId: number,
  input: { title: string; platform: PlatformType; url?: string },
) {
  const owner = await ctx.db
    .select()
    .from(collections)
    .where(and(eq(collections.id, pathId), eq(collections.organizationId, ctx.organizationId)));
  if (!owner[0]) throw new Error("Path not found in this workspace");

  const externalId = input.url && input.url.length > 0 ? input.url : `manual-${nanoid()}`;
  const existing = await ctx.db
    .select()
    .from(learningResources)
    .where(
      and(
        eq(learningResources.platform, input.platform),
        eq(learningResources.externalId, externalId),
      ),
    );

  let resourceId: number;
  if (existing[0]) {
    resourceId = existing[0].id;
  } else {
    const [res] = await ctx.db.insert(learningResources).values({
      sourceType: "external",
      platform: input.platform,
      externalId,
      url: input.url ?? null,
      title: input.title,
    });
    resourceId = res.insertId;
  }

  const dup = await ctx.db
    .select()
    .from(collectionItems)
    .where(
      and(eq(collectionItems.collectionId, pathId), eq(collectionItems.resourceId, resourceId)),
    );
  if (dup[0]) return { resourceId, itemId: dup[0].id };

  const siblings = await ctx.db
    .select()
    .from(collectionItems)
    .where(eq(collectionItems.collectionId, pathId));
  const [itemRes] = await ctx.db.insert(collectionItems).values({
    collectionId: pathId,
    resourceId,
    position: siblings.length,
  });
  return { resourceId, itemId: itemRes.insertId };
}

export async function setItemStatus(ctx: TenantContext, resourceId: number, done: boolean) {
  const existing = await ctx.db
    .select()
    .from(userActivities)
    .where(
      and(eq(userActivities.userId, ctx.userId), eq(userActivities.resourceId, resourceId)),
    );
  const now = new Date();
  const values = {
    status: done ? ("completed" as const) : ("not_started" as const),
    progress: done ? 100 : 0,
    completedAt: done ? now : null,
    lastActivityAt: now,
  };

  if (existing[0]) {
    await ctx.db.update(userActivities).set(values).where(eq(userActivities.id, existing[0].id));
  } else {
    await ctx.db.insert(userActivities).values({ userId: ctx.userId, resourceId, ...values });
  }
  return { success: true };
}

/** The learner's three development gauges — average progress across paths feeding each. */
export async function getProgressionForUser(db: DB, organizationId: number, userId: number) {
  const paths = await listPathsForUser(db, organizationId, userId);
  const dimensions: Dimension[] = ["knowledge", "skills", "human_development"];
  return dimensions.map((dimension) => {
    const relevant = paths.filter((p) => p.dimensions.includes(dimension));
    const score = relevant.length
      ? Math.round(relevant.reduce((sum, p) => sum + p.progress, 0) / relevant.length)
      : 0;
    return { dimension, score, pathCount: relevant.length };
  });
}

export async function getProgression(ctx: TenantContext) {
  return getProgressionForUser(ctx.db, ctx.organizationId, ctx.userId);
}
