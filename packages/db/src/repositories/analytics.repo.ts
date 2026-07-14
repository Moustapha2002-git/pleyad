import { and, eq, inArray } from "drizzle-orm";
import type { DB } from "../client";
import {
  collectionDimensions,
  collectionItems,
  pathAssignments,
  userActivities,
} from "../schema";
import type { Dimension } from "../schema";
import { getOrganizationMembers } from "./organizations.repo";
import { getOrgMentorAssignments } from "./mentorship.repo";

/**
 * Cohort analytics for the admin console. Everything here is DERIVED on read from
 * assignments + user_activities (the same source the learner gauges use) — there
 * are no stored aggregates to keep in sync. "Progress" of a (learner, path) pair
 * is the share of that path's items the learner has marked completed.
 */

const DIMENSIONS: Dimension[] = ["knowledge", "skills", "human_development"];
const INACTIVE_DAYS = 7;
const DAY_MS = 86_400_000;
const MENTOR_ROLES = ["owner", "admin", "manager", "mentor"];

export type AtRiskLearner = {
  userId: number;
  name: string | null;
  email: string;
  avgProgress: number;
  assignedCount: number;
  reason: "overdue" | "not_started" | "inactive";
  mentorName: string | null;
  lastActivityAt: Date | null;
};

export type CohortOverview = {
  totals: {
    learners: number;
    mentors: number;
    activeLearners: number; // active on assigned work within the last INACTIVE_DAYS
    avgProgress: number; // mean progress across every assigned (learner, path) pair
    assignedPaths: number; // count of assigned (learner, path) pairs
  };
  dimensions: {
    dimension: Dimension;
    avgProgress: number;
    pathCount: number; // assigned pairs feeding this dimension
    learnerCount: number; // distinct learners with a path feeding this dimension
  }[];
  funnel: { notStarted: number; inProgress: number; completed: number; total: number };
  atRisk: AtRiskLearner[];
};

export async function getCohortOverview(
  db: DB,
  organizationId: number,
): Promise<CohortOverview> {
  const members = await getOrganizationMembers(db, organizationId);
  const learners = members.filter((m) => m.role === "member");
  const mentors = members.filter((m) => MENTOR_ROLES.includes(m.role));
  const nameByUser = new Map(members.map((m) => [m.userId, m.name]));

  const base: CohortOverview = {
    totals: {
      learners: learners.length,
      mentors: mentors.length,
      activeLearners: 0,
      avgProgress: 0,
      assignedPaths: 0,
    },
    dimensions: DIMENSIONS.map((dimension) => ({
      dimension,
      avgProgress: 0,
      pathCount: 0,
      learnerCount: 0,
    })),
    funnel: { notStarted: 0, inProgress: 0, completed: 0, total: 0 },
    atRisk: [],
  };
  if (learners.length === 0) return base;

  const learnerIds = learners.map((l) => l.userId);
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
    getOrgMentorAssignments(db, organizationId),
  ]);
  if (assigns.length === 0) return base;

  const collectionIds = [...new Set(assigns.map((a) => a.collectionId))];
  const [dims, items] = await Promise.all([
    db
      .select()
      .from(collectionDimensions)
      .where(inArray(collectionDimensions.collectionId, collectionIds)),
    db
      .select()
      .from(collectionItems)
      .where(inArray(collectionItems.collectionId, collectionIds)),
  ]);
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

  // ── Indexes ──────────────────────────────────────────────────────────────
  const itemsByCollection = new Map<number, number[]>(); // collectionId -> resourceIds
  for (const it of items) {
    const arr = itemsByCollection.get(it.collectionId) ?? [];
    arr.push(it.resourceId);
    itemsByCollection.set(it.collectionId, arr);
  }
  const dimsByCollection = new Map<number, Dimension[]>();
  for (const d of dims) {
    const arr = dimsByCollection.get(d.collectionId) ?? [];
    arr.push(d.dimension);
    dimsByCollection.set(d.collectionId, arr);
  }
  const doneByUser = new Map<number, Set<number>>(); // userId -> completed resourceIds
  const lastActivityByUser = new Map<number, number>(); // userId -> latest activity ms
  for (const a of acts) {
    if (a.status === "completed") {
      const set = doneByUser.get(a.userId) ?? new Set<number>();
      set.add(a.resourceId);
      doneByUser.set(a.userId, set);
    }
    if (a.lastActivityAt) {
      const t = new Date(a.lastActivityAt).getTime();
      if (t > (lastActivityByUser.get(a.userId) ?? 0)) lastActivityByUser.set(a.userId, t);
    }
  }
  const mentorByLearner = new Map(mentorLinks.map((m) => [m.learnerUserId, m.mentorUserId]));

  const pathProgress = (userId: number, collectionId: number): number => {
    const resIds = itemsByCollection.get(collectionId) ?? [];
    if (resIds.length === 0) return 0;
    const done = doneByUser.get(userId);
    if (!done) return 0;
    const completed = resIds.filter((r) => done.has(r)).length;
    return Math.round((completed / resIds.length) * 100);
  };

  // ── Walk every learner ─────────────────────────────────────────────────────
  const now = Date.now();
  const pairs: { userId: number; progress: number; dimensions: Dimension[] }[] = [];
  const atRisk: AtRiskLearner[] = [];
  let activeLearners = 0;

  for (const l of learners) {
    const lastAct = lastActivityByUser.get(l.userId) ?? null;
    if (lastAct && now - lastAct <= INACTIVE_DAYS * DAY_MS) activeLearners++;

    const mine = assigns.filter((a) => a.learnerUserId === l.userId);
    if (mine.length === 0) continue;

    const detailed = mine.map((a) => {
      const progress = pathProgress(l.userId, a.collectionId);
      const dimensions = dimsByCollection.get(a.collectionId) ?? [];
      pairs.push({ userId: l.userId, progress, dimensions });
      return { progress, dueAt: a.dueAt ? new Date(a.dueAt) : null };
    });

    const avg = Math.round(detailed.reduce((s, p) => s + p.progress, 0) / detailed.length);
    const overdue = detailed.some((p) => p.dueAt && p.dueAt.getTime() < now && p.progress < 100);
    const inactive = !lastAct || now - lastAct > INACTIVE_DAYS * DAY_MS;

    let reason: AtRiskLearner["reason"] | null = null;
    if (avg < 100) {
      if (overdue) reason = "overdue";
      else if (avg === 0) reason = "not_started";
      else if (inactive) reason = "inactive";
    }
    if (reason) {
      const mentorId = mentorByLearner.get(l.userId);
      atRisk.push({
        userId: l.userId,
        name: l.name,
        email: l.email,
        avgProgress: avg,
        assignedCount: detailed.length,
        reason,
        mentorName: mentorId != null ? (nameByUser.get(mentorId) ?? null) : null,
        lastActivityAt: lastAct ? new Date(lastAct) : null,
      });
    }
  }

  // ── Aggregates ─────────────────────────────────────────────────────────────
  const dimensions = DIMENSIONS.map((dimension) => {
    const rel = pairs.filter((p) => p.dimensions.includes(dimension));
    return {
      dimension,
      avgProgress: rel.length
        ? Math.round(rel.reduce((s, p) => s + p.progress, 0) / rel.length)
        : 0,
      pathCount: rel.length,
      learnerCount: new Set(rel.map((p) => p.userId)).size,
    };
  });

  const notStarted = pairs.filter((p) => p.progress === 0).length;
  const completed = pairs.filter((p) => p.progress === 100).length;
  const inProgress = pairs.length - notStarted - completed;
  const avgProgress = pairs.length
    ? Math.round(pairs.reduce((s, p) => s + p.progress, 0) / pairs.length)
    : 0;

  const severity = { overdue: 0, not_started: 1, inactive: 2 };
  atRisk.sort((a, b) => severity[a.reason] - severity[b.reason] || a.avgProgress - b.avgProgress);

  return {
    totals: {
      learners: learners.length,
      mentors: mentors.length,
      activeLearners,
      avgProgress,
      assignedPaths: pairs.length,
    },
    dimensions,
    funnel: { notStarted, inProgress, completed, total: pairs.length },
    atRisk,
  };
}
