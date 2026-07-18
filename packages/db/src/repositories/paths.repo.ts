import { and, eq, inArray } from "drizzle-orm";
import { nanoid } from "nanoid";
import type { DB } from "../client";
import {
  collectionDimensions,
  collectionItems,
  collections,
  learningResources,
  pathAssignments,
  userActivities,
} from "../schema";
import type { Dimension, InsertLearningResource } from "../schema";
import type { TenantContext } from "./context";

type PlatformType = NonNullable<InsertLearningResource["platform"]>;

/**
 * Learning paths = collections with kind="path", tagged with 1–3 dimensions.
 * Progress and the per-dimension gauges are DERIVED from user_activities — there
 * are no stored counters to keep in sync.
 *
 * Progress model: each item (skill/course) carries 0–100 self-reported progress
 * (user_activities.progress; status completed ⇒ 100). A path's progress is the
 * AVERAGE of its items' progress — partial work counts everywhere.
 */

/** resourceId → 0–100 progress for one user (completed always counts as 100). */
function progressMap(acts: { resourceId: number; status: string; progress: number }[]) {
  const m = new Map<number, number>();
  for (const a of acts) {
    m.set(
      a.resourceId,
      a.status === "completed" ? 100 : Math.max(0, Math.min(100, a.progress ?? 0)),
    );
  }
  return m;
}

/** Aggregate a set of item resource-ids against a user's progress map. */
function pathStats(resourceIds: number[], prog: Map<number, number>) {
  const total = resourceIds.length;
  if (total === 0) return { total, completed: 0, progress: 0 };
  let sum = 0;
  let completed = 0;
  for (const r of resourceIds) {
    const p = prog.get(r) ?? 0;
    sum += p;
    if (p >= 100) completed++;
  }
  return { total, completed, progress: Math.round(sum / total) };
}

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
  const prog = progressMap(acts);

  return paths.map((p) => {
    const pItems = items.filter((i) => i.collectionId === p.id);
    const stats = pathStats(
      pItems.map((i) => i.resourceId),
      prog,
    );
    return {
      id: p.id,
      publicId: p.publicId,
      title: p.title,
      description: p.description,
      dimensions: dims.filter((d) => d.collectionId === p.id).map((d) => d.dimension),
      itemCount: stats.total,
      completedCount: stats.completed,
      progress: stats.progress,
    };
  });
}

export async function listPaths(ctx: TenantContext) {
  return listPathsForUser(ctx.db, ctx.organizationId, ctx.userId);
}

/**
 * A learner's own self-curated playlists (kind=playlist, owned by them) with their
 * progress. Same derivation as paths — reuses collection items + user activities.
 */
export async function listPlaylistsForOwner(db: DB, organizationId: number, userId: number) {
  const rows = await db
    .select()
    .from(collections)
    .where(
      and(
        eq(collections.organizationId, organizationId),
        eq(collections.kind, "playlist"),
        eq(collections.ownerUserId, userId),
      ),
    );
  if (rows.length === 0) return [];

  const ids = rows.map((p) => p.id);
  const items = await db
    .select()
    .from(collectionItems)
    .where(inArray(collectionItems.collectionId, ids));
  const resourceIds = items.map((i) => i.resourceId);
  const acts = resourceIds.length
    ? await db
        .select()
        .from(userActivities)
        .where(
          and(eq(userActivities.userId, userId), inArray(userActivities.resourceId, resourceIds)),
        )
    : [];
  const prog = progressMap(acts);

  return rows.map((p) => {
    const pItems = items.filter((i) => i.collectionId === p.id);
    const stats = pathStats(
      pItems.map((i) => i.resourceId),
      prog,
    );
    return {
      id: p.id,
      publicId: p.publicId,
      title: p.title,
      description: p.description,
      itemCount: stats.total,
      completedCount: stats.completed,
      progress: stats.progress,
    };
  });
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
  const prog = progressMap(acts);

  const items = joined.map((r) => {
    const p = prog.get(r.resource.id) ?? 0;
    return {
      itemId: r.item.id,
      resourceId: r.resource.id,
      title: r.resource.title,
      platform: r.resource.platform,
      url: r.resource.url,
      thumbnailUrl: r.resource.thumbnailUrl,
      progress: p,
      done: p >= 100,
    };
  });
  const stats = pathStats(
    items.map((i) => i.resourceId),
    prog,
  );

  return {
    id: path.id,
    publicId: path.publicId,
    title: path.title,
    description: path.description,
    dimensions: dims,
    items,
    itemCount: stats.total,
    completedCount: stats.completed,
    progress: stats.progress,
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

/** Self-reported progress on one skill/course (0–100). 100 ⇒ completed. */
export async function setItemProgress(ctx: TenantContext, resourceId: number, progress: number) {
  const p = Math.max(0, Math.min(100, Math.round(progress)));
  const existing = await ctx.db
    .select()
    .from(userActivities)
    .where(
      and(eq(userActivities.userId, ctx.userId), eq(userActivities.resourceId, resourceId)),
    );
  const now = new Date();
  const values = {
    status: p >= 100 ? ("completed" as const) : p > 0 ? ("in_progress" as const) : ("not_started" as const),
    progress: p,
    completedAt: p >= 100 ? now : null,
    lastActivityAt: now,
  };
  if (existing[0]) {
    await ctx.db.update(userActivities).set(values).where(eq(userActivities.id, existing[0].id));
  } else {
    await ctx.db.insert(userActivities).values({ userId: ctx.userId, resourceId, ...values });
  }
  return { success: true, progress: p };
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

// ── Assignments ─────────────────────────────────────────────────────────

/** Assign a learning path to a learner (idempotent; updates the due date). */
export async function assignPath(
  db: DB,
  organizationId: number,
  collectionId: number,
  learnerUserId: number,
  assignedByUserId: number,
  dueAt: Date | null,
) {
  const existing = await db
    .select()
    .from(pathAssignments)
    .where(
      and(
        eq(pathAssignments.organizationId, organizationId),
        eq(pathAssignments.collectionId, collectionId),
        eq(pathAssignments.learnerUserId, learnerUserId),
      ),
    );
  if (existing[0]) {
    await db.update(pathAssignments).set({ dueAt }).where(eq(pathAssignments.id, existing[0].id));
    return existing[0].id;
  }
  const [res] = await db
    .insert(pathAssignments)
    .values({ organizationId, collectionId, learnerUserId, assignedByUserId, dueAt });
  return res.insertId;
}

export async function unassignPath(
  db: DB,
  organizationId: number,
  collectionId: number,
  learnerUserId: number,
) {
  await db
    .delete(pathAssignments)
    .where(
      and(
        eq(pathAssignments.organizationId, organizationId),
        eq(pathAssignments.collectionId, collectionId),
        eq(pathAssignments.learnerUserId, learnerUserId),
      ),
    );
  return { ok: true };
}

/** Paths assigned to a learner, with the learner's progress + due date. */
export async function getAssignedPaths(db: DB, organizationId: number, learnerUserId: number) {
  const assigns = await db
    .select()
    .from(pathAssignments)
    .where(
      and(
        eq(pathAssignments.organizationId, organizationId),
        eq(pathAssignments.learnerUserId, learnerUserId),
      ),
    );
  if (assigns.length === 0) return [];

  const collectionIds = assigns.map((a) => a.collectionId);
  const dueByCollection = new Map(assigns.map((a) => [a.collectionId, a.dueAt]));

  const paths = await db.select().from(collections).where(inArray(collections.id, collectionIds));
  const dims = await db
    .select()
    .from(collectionDimensions)
    .where(inArray(collectionDimensions.collectionId, collectionIds));
  const items = await db
    .select()
    .from(collectionItems)
    .where(inArray(collectionItems.collectionId, collectionIds));
  const resourceIds = items.map((i) => i.resourceId);
  const acts = resourceIds.length
    ? await db
        .select()
        .from(userActivities)
        .where(
          and(
            eq(userActivities.userId, learnerUserId),
            inArray(userActivities.resourceId, resourceIds),
          ),
        )
    : [];
  const prog = progressMap(acts);

  return paths.map((p) => {
    const pItems = items.filter((i) => i.collectionId === p.id);
    const stats = pathStats(
      pItems.map((i) => i.resourceId),
      prog,
    );
    return {
      id: p.id,
      publicId: p.publicId,
      title: p.title,
      description: p.description,
      dimensions: dims.filter((d) => d.collectionId === p.id).map((d) => d.dimension),
      itemCount: stats.total,
      completedCount: stats.completed,
      progress: stats.progress,
      dueAt: dueByCollection.get(p.id) ?? null,
    };
  });
}

export async function getProgression(ctx: TenantContext) {
  return getProgressionForUser(ctx.db, ctx.organizationId, ctx.userId);
}

/**
 * Delete a path and its org-scoped children (assignments, dimension tags, item
 * links). Learners' personal activity records and the shared course resources
 * are deliberately untouched — they belong to users / the global catalog.
 */
export async function deletePath(db: DB, organizationId: number, collectionId: number) {
  const rows = await db
    .select()
    .from(collections)
    .where(
      and(
        eq(collections.id, collectionId),
        eq(collections.organizationId, organizationId),
        eq(collections.kind, "path"),
      ),
    );
  if (!rows[0]) return { ok: false };

  await db
    .delete(pathAssignments)
    .where(
      and(
        eq(pathAssignments.organizationId, organizationId),
        eq(pathAssignments.collectionId, collectionId),
      ),
    );
  await db.delete(collectionDimensions).where(eq(collectionDimensions.collectionId, collectionId));
  await db.delete(collectionItems).where(eq(collectionItems.collectionId, collectionId));
  await db.delete(collections).where(eq(collections.id, collectionId));
  return { ok: true };
}

/** Learner user-ids already assigned to a collection (to flag them in bulk-assign UIs). */
export async function getAssignedLearnerIds(db: DB, organizationId: number, collectionId: number) {
  const rows = await db
    .select({ learnerUserId: pathAssignments.learnerUserId })
    .from(pathAssignments)
    .where(
      and(
        eq(pathAssignments.organizationId, organizationId),
        eq(pathAssignments.collectionId, collectionId),
      ),
    );
  return rows.map((r) => r.learnerUserId);
}
