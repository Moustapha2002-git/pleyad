import { and, desc, eq } from "drizzle-orm";
import type { DB } from "../client";
import { learnerTasks, mentorFeedback, users } from "../schema";

// ── Tasks / exercises ─────────────────────────────────────────────────────

export async function createTask(
  db: DB,
  input: {
    organizationId: number;
    mentorUserId: number;
    learnerUserId: number;
    title: string;
    instructions: string | null;
    dueAt: Date | null;
  },
) {
  const [res] = await db.insert(learnerTasks).values(input);
  return res.insertId;
}

export async function getTasksForLearner(db: DB, organizationId: number, learnerUserId: number) {
  return db
    .select({
      id: learnerTasks.id,
      title: learnerTasks.title,
      instructions: learnerTasks.instructions,
      dueAt: learnerTasks.dueAt,
      status: learnerTasks.status,
      createdAt: learnerTasks.createdAt,
      mentorName: users.name,
    })
    .from(learnerTasks)
    .innerJoin(users, eq(learnerTasks.mentorUserId, users.id))
    .where(
      and(
        eq(learnerTasks.organizationId, organizationId),
        eq(learnerTasks.learnerUserId, learnerUserId),
      ),
    )
    .orderBy(desc(learnerTasks.createdAt));
}

/** The learner marks their own task done/undone (scoped to learnerUserId). */
export async function setTaskStatus(
  db: DB,
  organizationId: number,
  taskId: number,
  learnerUserId: number,
  done: boolean,
) {
  await db
    .update(learnerTasks)
    .set({ status: done ? "done" : "open", completedAt: done ? new Date() : null })
    .where(
      and(
        eq(learnerTasks.id, taskId),
        eq(learnerTasks.organizationId, organizationId),
        eq(learnerTasks.learnerUserId, learnerUserId),
      ),
    );
  return { ok: true };
}

/** The mentor (author) deletes a task. */
export async function deleteTask(
  db: DB,
  organizationId: number,
  taskId: number,
  mentorUserId: number,
) {
  await db
    .delete(learnerTasks)
    .where(
      and(
        eq(learnerTasks.id, taskId),
        eq(learnerTasks.organizationId, organizationId),
        eq(learnerTasks.mentorUserId, mentorUserId),
      ),
    );
  return { ok: true };
}

// ── Feedback ──────────────────────────────────────────────────────────────

export async function addFeedback(
  db: DB,
  input: { organizationId: number; mentorUserId: number; learnerUserId: number; body: string },
) {
  const [res] = await db.insert(mentorFeedback).values(input);
  return res.insertId;
}

export async function getFeedbackForLearner(
  db: DB,
  organizationId: number,
  learnerUserId: number,
) {
  return db
    .select({
      id: mentorFeedback.id,
      body: mentorFeedback.body,
      createdAt: mentorFeedback.createdAt,
      mentorName: users.name,
    })
    .from(mentorFeedback)
    .innerJoin(users, eq(mentorFeedback.mentorUserId, users.id))
    .where(
      and(
        eq(mentorFeedback.organizationId, organizationId),
        eq(mentorFeedback.learnerUserId, learnerUserId),
      ),
    )
    .orderBy(desc(mentorFeedback.createdAt));
}
