import { and, eq, gt, inArray } from "drizzle-orm";
import type { DB } from "../client";
import {
  collectionDimensions,
  collectionItems,
  collections,
  learningResources,
  memberships,
  mentorAssignments,
  mentoringSessions,
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

// ── Mentor directory (admin staff view) ──────────────────────────────────

const INACTIVE_DAYS = 7;
const DAY_MS = 86_400_000;

export type MentorDirectoryRow = {
  userId: number;
  name: string | null;
  email: string;
  role: string;
  joinedAt: Date;
  lastSignedInAt: Date | null;
  learnerCount: number;
  avgProgress: number; // mean of mentees' path-average progress
  atRiskCount: number;
  completedLearners: number;
  pathsAuthored: number;
  upcomingSessions: number;
  nextSessionAt: Date | null;
};

/**
 * Every mentor with workload + cohort performance. Includes mentor/manager
 * roles always, plus admins/owners only when they actually mentor someone.
 * Reuses the learner directory for per-learner stats (one shared formula).
 */
export async function listMentorDirectory(
  db: DB,
  organizationId: number,
): Promise<MentorDirectoryRow[]> {
  const [staff, links, learners, authored, sessions] = await Promise.all([
    db
      .select({
        userId: memberships.userId,
        role: memberships.role,
        joinedAt: memberships.createdAt,
        name: users.name,
        email: users.email,
        lastSignedInAt: users.lastSignedInAt,
      })
      .from(memberships)
      .innerJoin(users, eq(memberships.userId, users.id))
      .where(
        and(
          eq(memberships.organizationId, organizationId),
          inArray(memberships.role, ["mentor", "manager", "admin", "owner"]),
        ),
      ),
    db
      .select()
      .from(mentorAssignments)
      .where(eq(mentorAssignments.organizationId, organizationId)),
    listLearnerDirectory(db, organizationId),
    db
      .select({ ownerUserId: collections.ownerUserId })
      .from(collections)
      .where(and(eq(collections.organizationId, organizationId), eq(collections.kind, "path"))),
    db
      .select({
        mentorUserId: mentoringSessions.mentorUserId,
        scheduledAt: mentoringSessions.scheduledAt,
      })
      .from(mentoringSessions)
      .where(
        and(
          eq(mentoringSessions.organizationId, organizationId),
          eq(mentoringSessions.status, "scheduled"),
          gt(mentoringSessions.scheduledAt, new Date()),
        ),
      ),
  ]);

  const now = Date.now();
  const learnerById = new Map(learners.map((l) => [l.userId, l]));
  const menteesByMentor = new Map<number, number[]>();
  for (const l of links) {
    const arr = menteesByMentor.get(l.mentorUserId) ?? [];
    arr.push(l.learnerUserId);
    menteesByMentor.set(l.mentorUserId, arr);
  }
  const authoredBy = new Map<number, number>();
  for (const a of authored) {
    if (a.ownerUserId != null)
      authoredBy.set(a.ownerUserId, (authoredBy.get(a.ownerUserId) ?? 0) + 1);
  }
  const sessionsBy = new Map<number, { count: number; next: Date | null }>();
  for (const s of sessions) {
    const cur = sessionsBy.get(s.mentorUserId) ?? { count: 0, next: null };
    cur.count++;
    const when = new Date(s.scheduledAt);
    if (!cur.next || when < cur.next) cur.next = when;
    sessionsBy.set(s.mentorUserId, cur);
  }

  return staff
    .filter(
      (m) =>
        m.role === "mentor" ||
        m.role === "manager" ||
        (menteesByMentor.get(m.userId)?.length ?? 0) > 0,
    )
    .map((m) => {
      const mentees = (menteesByMentor.get(m.userId) ?? [])
        .map((id) => learnerById.get(id))
        .filter((l): l is NonNullable<typeof l> => Boolean(l));
      const withWork = mentees.filter((l) => l.assignedCount > 0);
      const avgProgress = withWork.length
        ? Math.round(withWork.reduce((s, l) => s + l.avgProgress, 0) / withWork.length)
        : 0;
      const atRiskCount = mentees.filter(
        (l) =>
          l.assignedCount > 0 &&
          l.avgProgress < 100 &&
          (l.avgProgress === 0 ||
            !l.lastActivityAt ||
            now - l.lastActivityAt.getTime() > INACTIVE_DAYS * DAY_MS),
      ).length;
      const sess = sessionsBy.get(m.userId);
      return {
        userId: m.userId,
        name: m.name,
        email: m.email,
        role: m.role,
        joinedAt: m.joinedAt,
        lastSignedInAt: m.lastSignedInAt,
        learnerCount: mentees.length,
        avgProgress,
        atRiskCount,
        completedLearners: mentees.filter(
          (l) => l.assignedCount > 0 && l.avgProgress === 100,
        ).length,
        pathsAuthored: authoredBy.get(m.userId) ?? 0,
        upcomingSessions: sess?.count ?? 0,
        nextSessionAt: sess?.next ?? null,
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
  creatorId: number | null;
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
      creatorId: collections.ownerUserId,
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
      creatorId: p.creatorId,
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
