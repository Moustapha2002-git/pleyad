import { and, eq, inArray } from "drizzle-orm";
import type { DB } from "../client";
import {
  collectionItems,
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
  const doneByUser = new Map<number, Set<number>>();
  const lastActByUser = new Map<number, number>();
  for (const a of acts) {
    if (a.status === "completed") {
      const set = doneByUser.get(a.userId) ?? new Set<number>();
      set.add(a.resourceId);
      doneByUser.set(a.userId, set);
    }
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
    const done = doneByUser.get(m.userId);
    let sum = 0;
    let completed = 0;
    for (const a of mine) {
      const resIds = itemsByCollection.get(a.collectionId) ?? [];
      const total = resIds.length;
      const dc = total && done ? resIds.filter((r) => done.has(r)).length : 0;
      const progress = total > 0 ? Math.round((dc / total) * 100) : 0;
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
