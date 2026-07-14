import { and, eq, inArray, isNull } from "drizzle-orm";
import type { DB } from "../client";
import { messages, userActivities } from "../schema";
import { getLearnersForMentor } from "./mentorship.repo";
import { getAssignedPaths } from "./paths.repo";
import { getSessionsForUser } from "./sessions.repo";

/**
 * The mentor "cockpit" data: for each learner assigned to a mentor, the summary a
 * mentor needs at a glance — progress, risk, unread messages, next session. Derived
 * on read (no stored counters), consistent with the learner gauges + analytics.
 */

const INACTIVE_DAYS = 7;
const DAY_MS = 86_400_000;

export type MentorLearnerStat = {
  id: number;
  name: string | null;
  email: string;
  progress: number; // avg across assigned paths
  assignedCount: number;
  atRisk: "overdue" | "not_started" | "inactive" | null;
  lastActivityAt: Date | null;
  unread: number; // unread messages from this learner to the mentor
  nextSessionAt: Date | null;
};

export async function getMentorLearnerStats(
  db: DB,
  organizationId: number,
  mentorUserId: number,
): Promise<MentorLearnerStat[]> {
  const learners = await getLearnersForMentor(db, organizationId, mentorUserId);
  if (learners.length === 0) return [];
  const learnerIds = learners.map((l) => l.id);
  const now = Date.now();

  const [unread, acts, sessions] = await Promise.all([
    db
      .select({ sender: messages.senderUserId })
      .from(messages)
      .where(
        and(
          eq(messages.organizationId, organizationId),
          eq(messages.recipientUserId, mentorUserId),
          inArray(messages.senderUserId, learnerIds),
          isNull(messages.readAt),
        ),
      ),
    db
      .select({ userId: userActivities.userId, last: userActivities.lastActivityAt })
      .from(userActivities)
      .where(inArray(userActivities.userId, learnerIds)),
    getSessionsForUser(db, organizationId, mentorUserId),
  ]);

  const unreadBy = new Map<number, number>();
  for (const u of unread) unreadBy.set(u.sender, (unreadBy.get(u.sender) ?? 0) + 1);

  const lastBy = new Map<number, number>();
  for (const a of acts) {
    if (!a.last) continue;
    const t = new Date(a.last).getTime();
    if (t > (lastBy.get(a.userId) ?? 0)) lastBy.set(a.userId, t);
  }

  const nextBy = new Map<number, Date>();
  for (const s of sessions) {
    if (s.mentorUserId !== mentorUserId) continue;
    const t = new Date(s.scheduledAt).getTime();
    if (t < now) continue;
    const cur = nextBy.get(s.learnerUserId);
    if (!cur || t < cur.getTime()) nextBy.set(s.learnerUserId, new Date(s.scheduledAt));
  }

  const stats: MentorLearnerStat[] = [];
  for (const l of learners) {
    const assigned = await getAssignedPaths(db, organizationId, l.id);
    const count = assigned.length;
    const progress = count
      ? Math.round(assigned.reduce((s, p) => s + p.progress, 0) / count)
      : 0;
    const overdue = assigned.some(
      (p) => p.dueAt && new Date(p.dueAt).getTime() < now && p.progress < 100,
    );
    const last = lastBy.get(l.id) ?? null;
    const inactive = count > 0 && (!last || now - last > INACTIVE_DAYS * DAY_MS);

    let atRisk: MentorLearnerStat["atRisk"] = null;
    if (count > 0 && progress < 100) {
      if (overdue) atRisk = "overdue";
      else if (progress === 0) atRisk = "not_started";
      else if (inactive) atRisk = "inactive";
    }

    stats.push({
      id: l.id,
      name: l.name,
      email: l.email,
      progress,
      assignedCount: count,
      atRisk,
      lastActivityAt: last ? new Date(last) : null,
      unread: unreadBy.get(l.id) ?? 0,
      nextSessionAt: nextBy.get(l.id) ?? null,
    });
  }
  return stats;
}
