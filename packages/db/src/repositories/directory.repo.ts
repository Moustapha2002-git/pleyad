import { and, eq, inArray } from "drizzle-orm";
import type { DB } from "../client";
import {
  collectionDimensions,
  collectionItems,
  collections,
  learningResources,
  memberships,
  mentorAssignments,
  pathAssignments,
  userActivities,
  users,
} from "../schema";

/**
 * Admin learner directory. One batched query set (no per-learner loops) so it
 * stays flat as cohorts grow; filtering/sorting/paging happen in the router on
 * the computed rows.
 */

export type LearnerDirectoryRow = {
  userId: number;
  name: string | null;
  email: string;
  membershipStatus: "active" | "invited" | "suspended";
  joinedAt: Date;
  registeredAt: Date;
  lastSignedInAt: Date | null;
  assignedCount: number;
  completedCount: number; // paths at 100%
  avgProgress: number;
  lastActivityAt: Date | null;
  mentors: { id: number; name: string | null }[];
};

export async function listLearnerDirectory(
  db: DB,
  organizationId: number,
): Promise<LearnerDirectoryRow[]> {
  const mems = await db
    .select({
      userId: memberships.userId,
      status: memberships.status,
      joinedAt: memberships.createdAt,
      name: users.name,
      email: users.email,
      registeredAt: users.createdAt,
      lastSignedInAt: users.lastSignedInAt,
    })
    .from(memberships)
    .innerJoin(users, eq(memberships.userId, users.id))
    .where(and(eq(memberships.organizationId, organizationId), eq(memberships.role, "member")));
  if (mems.length === 0) return [];
  const learnerIds = mems.map((m) => m.userId);

  const [assigns, mentorLinks] = await Promise.all([
    db
      .select()
      .from(pathAssignments)
      .where(
        and(
          eq(pathAssignments.organizationId, organizationId),
          inArray(pathAssignments.learnerUserId, learnerIds),
        ),
      ),
    db
      .select({
        mentorUserId: mentorAssignments.mentorUserId,
        learnerUserId: mentorAssignments.learnerUserId,
        mentorName: users.name,
      })
      .from(mentorAssignments)
      .innerJoin(users, eq(mentorAssignments.mentorUserId, users.id))
      .where(eq(mentorAssignments.organizationId, organizationId)),
  ]);

  const collectionIds = [...new Set(assigns.map((a) => a.collectionId))];
  const items = collectionIds.length
    ? await db
        .select()
        .from(collectionItems)
        .where(inArray(collectionItems.collectionId, collectionIds))
    : [];
  const resourceIds = [...new Set(items.map((i) => i.resourceId))];
  const acts = resourceIds.length
    ? await db
        .select()
        .from(userActivities)
        .where(
          and(
            inArray(userActivities.userId, learnerIds),
            inArray(userActivities.resourceId, resourceIds),
          ),
        )
    : [];

  const itemsByCollection = new Map<number, number[]>();
  for (const it of items) {
    const arr = itemsByCollection.get(it.collectionId) ?? [];
    arr.push(it.resourceId);
    itemsByCollection.set(it.collectionId, arr);
  }
  const progByUser = new Map<number, Map<number, number>>();
  const lastActByUser = new Map<number, number>();
  for (const a of acts) {
    const m = progByUser.get(a.userId) ?? new Map<number, number>();
    m.set(a.resourceId, a.status === "completed" ? 100 : Math.max(0, Math.min(100, a.progress)));
    progByUser.set(a.userId, m);
    if (a.lastActivityAt) {
      const t = new Date(a.lastActivityAt).getTime();
      if (t > (lastActByUser.get(a.userId) ?? 0)) lastActByUser.set(a.userId, t);
    }
  }
  const mentorsByLearner = new Map<number, { id: number; name: string | null }[]>();
  for (const m of mentorLinks) {
    const arr = mentorsByLearner.get(m.learnerUserId) ?? [];
    arr.push({ id: m.mentorUserId, name: m.mentorName });
    mentorsByLearner.set(m.learnerUserId, arr);
  }

  return mems.map((m) => {
    const mine = assigns.filter((a) => a.learnerUserId === m.userId);
    const prog = progByUser.get(m.userId);
    let sum = 0;
    let completed = 0;
    for (const a of mine) {
      const resIds = itemsByCollection.get(a.collectionId) ?? [];
      const total = resIds.length;
      const progress =
        total > 0 ? Math.round(resIds.reduce((s, r) => s + (prog?.get(r) ?? 0), 0) / total) : 0;
      sum += progress;
      if (total > 0 && progress === 100) completed++;
    }
    const last = lastActByUser.get(m.userId);
    return {
      userId: m.userId,
      name: m.name,
      email: m.email,
      membershipStatus: m.status,
      joinedAt: m.joinedAt,
      registeredAt: m.registeredAt,
      lastSignedInAt: m.lastSignedInAt,
      assignedCount: mine.length,
      completedCount: completed,
      avgProgress: mine.length ? Math.round(sum / mine.length) : 0,
      lastActivityAt: last ? new Date(last) : null,
      mentors: mentorsByLearner.get(m.userId) ?? [],
    };
  });
}

// ── Path directory (admin catalog view) ──────────────────────────────────

export type PathDirectoryRow = {
  id: number;
  title: string;
  description: string | null;
  dimensions: string[];
  skillCount: number;
  /** First few skills, for thumbnail strips (client derives YouTube thumbs). */
  previewSkills: { title: string; url: string | null; thumbnailUrl: string | null }[];
  enrolledCount: number;
  avgProgress: number; // mean path-progress across enrolled learners
  completedLearners: number;
  creatorName: string | null;
  createdAt: Date;
};

/** Every path in the org with skills + enrollment + cohort progress. Batched. */
export async function listPathDirectory(
  db: DB,
  organizationId: number,
): Promise<PathDirectoryRow[]> {
  const paths = await db
    .select({
      id: collections.id,
      title: collections.title,
      description: collections.description,
      createdAt: collections.createdAt,
      creatorName: users.name,
    })
    .from(collections)
    .leftJoin(users, eq(collections.ownerUserId, users.id))
    .where(and(eq(collections.organizationId, organizationId), eq(collections.kind, "path")));
  if (paths.length === 0) return [];
  const pathIds = paths.map((p) => p.id);

  const [dims, items, assigns] = await Promise.all([
    db
      .select()
      .from(collectionDimensions)
      .where(inArray(collectionDimensions.collectionId, pathIds)),
    db
      .select({
        collectionId: collectionItems.collectionId,
        resourceId: collectionItems.resourceId,
        position: collectionItems.position,
        title: learningResources.title,
        url: learningResources.url,
        thumbnailUrl: learningResources.thumbnailUrl,
      })
      .from(collectionItems)
      .innerJoin(learningResources, eq(collectionItems.resourceId, learningResources.id))
      .where(inArray(collectionItems.collectionId, pathIds)),
    db
      .select()
      .from(pathAssignments)
      .where(
        and(
          eq(pathAssignments.organizationId, organizationId),
          inArray(pathAssignments.collectionId, pathIds),
        ),
      ),
  ]);

  const learnerIds = [...new Set(assigns.map((a) => a.learnerUserId))];
  const resourceIds = [...new Set(items.map((i) => i.resourceId))];
  const acts =
    learnerIds.length && resourceIds.length
      ? await db
          .select()
          .from(userActivities)
          .where(
            and(
              inArray(userActivities.userId, learnerIds),
              inArray(userActivities.resourceId, resourceIds),
            ),
          )
      : [];
  const progByUser = new Map<number, Map<number, number>>();
  for (const a of acts) {
    const m = progByUser.get(a.userId) ?? new Map<number, number>();
    m.set(a.resourceId, a.status === "completed" ? 100 : Math.max(0, Math.min(100, a.progress)));
    progByUser.set(a.userId, m);
  }

  return paths.map((p) => {
    const pItems = items
      .filter((i) => i.collectionId === p.id)
      .sort((a, b) => a.position - b.position);
    const resIds = pItems.map((i) => i.resourceId);
    const enrolled = assigns.filter((a) => a.collectionId === p.id);

    let sum = 0;
    let completedLearners = 0;
    for (const a of enrolled) {
      const prog = progByUser.get(a.learnerUserId);
      const pct =
        resIds.length > 0
          ? Math.round(resIds.reduce((s, r) => s + (prog?.get(r) ?? 0), 0) / resIds.length)
          : 0;
      sum += pct;
      if (resIds.length > 0 && pct === 100) completedLearners++;
    }

    return {
      id: p.id,
      title: p.title,
      description: p.description,
      dimensions: dims.filter((d) => d.collectionId === p.id).map((d) => d.dimension),
      skillCount: pItems.length,
      previewSkills: pItems
        .slice(0, 3)
        .map((i) => ({ title: i.title, url: i.url, thumbnailUrl: i.thumbnailUrl })),
      enrolledCount: enrolled.length,
      avgProgress: enrolled.length ? Math.round(sum / enrolled.length) : 0,
      completedLearners,
      creatorName: p.creatorName,
      createdAt: p.createdAt,
    };
  });
}

/** Suspend or reactivate a learner's membership (learners only — never staff). */
export async function setLearnerStatus(
  db: DB,
  organizationId: number,
  userId: number,
  status: "active" | "suspended",
) {
  await db
    .update(memberships)
    .set({ status })
    .where(
      and(
        eq(memberships.organizationId, organizationId),
        eq(memberships.userId, userId),
        eq(memberships.role, "member"),
      ),
    );
}

/**
 * Remove a learner from the workspace: membership + mentor links + path
 * assignments. The global account and personal learning data are untouched.
 */
export async function removeLearnerFromOrg(db: DB, organizationId: number, userId: number) {
  await db
    .delete(mentorAssignments)
    .where(
      and(
        eq(mentorAssignments.organizationId, organizationId),
        eq(mentorAssignments.learnerUserId, userId),
      ),
    );
  await db
    .delete(pathAssignments)
    .where(
      and(
        eq(pathAssignments.organizationId, organizationId),
        eq(pathAssignments.learnerUserId, userId),
      ),
    );
  await db
    .delete(memberships)
    .where(
      and(
        eq(memberships.organizationId, organizationId),
        eq(memberships.userId, userId),
        eq(memberships.role, "member"),
      ),
    );
}
