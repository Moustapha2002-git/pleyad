import { and, eq } from "drizzle-orm";
import type { DB } from "../client";
import { mentorAssignments, users } from "../schema";

/**
 * Mentor ↔ learner assignments, scoped to an organization. Reads take an explicit
 * organizationId + mentorUserId (resolved from the session upstream).
 */

export async function assignLearner(
  db: DB,
  organizationId: number,
  mentorUserId: number,
  learnerUserId: number,
) {
  const existing = await db
    .select()
    .from(mentorAssignments)
    .where(
      and(
        eq(mentorAssignments.organizationId, organizationId),
        eq(mentorAssignments.mentorUserId, mentorUserId),
        eq(mentorAssignments.learnerUserId, learnerUserId),
      ),
    );
  if (existing[0]) return existing[0].id;
  const [res] = await db
    .insert(mentorAssignments)
    .values({ organizationId, mentorUserId, learnerUserId });
  return res.insertId;
}

/** Learners assigned to a mentor in an organization. */
export async function getLearnersForMentor(
  db: DB,
  organizationId: number,
  mentorUserId: number,
) {
  return db
    .select({
      id: users.id,
      publicId: users.publicId,
      name: users.name,
      email: users.email,
    })
    .from(mentorAssignments)
    .innerJoin(users, eq(mentorAssignments.learnerUserId, users.id))
    .where(
      and(
        eq(mentorAssignments.organizationId, organizationId),
        eq(mentorAssignments.mentorUserId, mentorUserId),
      ),
    );
}

/** Mentors assigned to a learner in an organization (learner-facing). */
export async function getMentorsForLearner(
  db: DB,
  organizationId: number,
  learnerUserId: number,
) {
  return db
    .select({
      id: users.id,
      publicId: users.publicId,
      name: users.name,
      email: users.email,
    })
    .from(mentorAssignments)
    .innerJoin(users, eq(mentorAssignments.mentorUserId, users.id))
    .where(
      and(
        eq(mentorAssignments.organizationId, organizationId),
        eq(mentorAssignments.learnerUserId, learnerUserId),
      ),
    );
}

/** Authorization check: is `mentorUserId` the mentor of `learnerUserId` in this org? */
export async function isMentorOf(
  db: DB,
  organizationId: number,
  mentorUserId: number,
  learnerUserId: number,
) {
  const rows = await db
    .select()
    .from(mentorAssignments)
    .where(
      and(
        eq(mentorAssignments.organizationId, organizationId),
        eq(mentorAssignments.mentorUserId, mentorUserId),
        eq(mentorAssignments.learnerUserId, learnerUserId),
      ),
    );
  return rows.length > 0;
}
