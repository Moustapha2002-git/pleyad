import { and, asc, eq, or } from "drizzle-orm";
import { alias } from "drizzle-orm/mysql-core";
import type { DB } from "../client";
import { mentoringSessions, users } from "../schema";

const mentorU = alias(users, "mentor_u");
const learnerU = alias(users, "learner_u");

/** Schedule a mentoring session between a mentor and a learner. */
export async function scheduleSession(
  db: DB,
  input: {
    organizationId: number;
    mentorUserId: number;
    learnerUserId: number;
    title: string;
    scheduledAt: Date;
    durationMinutes: number;
    createdByUserId: number;
  },
) {
  const [res] = await db.insert(mentoringSessions).values(input);
  return res.insertId;
}

/** Scheduled sessions where the user is the mentor or the learner, soonest first. */
export async function getSessionsForUser(db: DB, organizationId: number, userId: number) {
  return db
    .select({
      id: mentoringSessions.id,
      title: mentoringSessions.title,
      scheduledAt: mentoringSessions.scheduledAt,
      durationMinutes: mentoringSessions.durationMinutes,
      status: mentoringSessions.status,
      mentorUserId: mentoringSessions.mentorUserId,
      learnerUserId: mentoringSessions.learnerUserId,
      mentorName: mentorU.name,
      mentorEmail: mentorU.email,
      learnerName: learnerU.name,
      learnerEmail: learnerU.email,
    })
    .from(mentoringSessions)
    .innerJoin(mentorU, eq(mentoringSessions.mentorUserId, mentorU.id))
    .innerJoin(learnerU, eq(mentoringSessions.learnerUserId, learnerU.id))
    .where(
      and(
        eq(mentoringSessions.organizationId, organizationId),
        eq(mentoringSessions.status, "scheduled"),
        or(
          eq(mentoringSessions.mentorUserId, userId),
          eq(mentoringSessions.learnerUserId, userId),
        ),
      ),
    )
    .orderBy(asc(mentoringSessions.scheduledAt));
}

/** Cancel a session — only a participant may cancel. */
export async function cancelSession(
  db: DB,
  organizationId: number,
  sessionId: number,
  userId: number,
) {
  await db
    .update(mentoringSessions)
    .set({ status: "cancelled" })
    .where(
      and(
        eq(mentoringSessions.id, sessionId),
        eq(mentoringSessions.organizationId, organizationId),
        or(
          eq(mentoringSessions.mentorUserId, userId),
          eq(mentoringSessions.learnerUserId, userId),
        ),
      ),
    );
  return { ok: true };
}
