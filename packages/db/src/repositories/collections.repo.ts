import { and, eq } from "drizzle-orm";
import { collections, collectionItems, learningResources } from "../schema";
import type { InsertCollection } from "../schema";
import type { TenantContext } from "./context";

/**
 * Collections repository. Every function is scoped by `ctx.organizationId` — the
 * tenant boundary. No function accepts an organization id from the caller; it
 * always comes from the resolved session context.
 */

export async function listCollections(ctx: TenantContext) {
  return ctx.db
    .select()
    .from(collections)
    .where(eq(collections.organizationId, ctx.organizationId));
}

export async function getCollection(ctx: TenantContext, id: number) {
  const rows = await ctx.db
    .select()
    .from(collections)
    .where(and(eq(collections.id, id), eq(collections.organizationId, ctx.organizationId)));
  return rows[0] ?? null;
}

export async function createCollection(
  ctx: TenantContext,
  input: Pick<InsertCollection, "title" | "description" | "goal" | "kind">,
) {
  const [result] = await ctx.db.insert(collections).values({
    organizationId: ctx.organizationId,
    ownerUserId: ctx.userId,
    title: input.title,
    description: input.description ?? null,
    goal: input.goal ?? null,
    kind: input.kind ?? "playlist",
  });
  return result.insertId;
}

/** Items in a collection, joined to their resources, ordered by position. */
export async function getCollectionItems(ctx: TenantContext, collectionId: number) {
  // Guard: confirm the collection belongs to this tenant before reading items.
  const owner = await getCollection(ctx, collectionId);
  if (!owner) return [];

  return ctx.db
    .select({
      item: collectionItems,
      resource: learningResources,
    })
    .from(collectionItems)
    .innerJoin(learningResources, eq(collectionItems.resourceId, learningResources.id))
    .where(eq(collectionItems.collectionId, collectionId))
    .orderBy(collectionItems.position);
}

export async function addItem(
  ctx: TenantContext,
  collectionId: number,
  resourceId: number,
  opts: { position?: number; section?: string; required?: boolean } = {},
) {
  const owner = await getCollection(ctx, collectionId);
  if (!owner) throw new Error("Collection not found in this workspace");

  await ctx.db.insert(collectionItems).values({
    collectionId,
    resourceId,
    position: opts.position ?? 0,
    section: opts.section ?? null,
    required: opts.required ?? true,
  });
}
