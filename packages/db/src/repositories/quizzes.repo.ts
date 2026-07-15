import { and, asc, desc, eq, inArray } from "drizzle-orm";
import type { DB } from "../client";
import { quizAttempts, quizQuestions, quizzes } from "../schema";

type NewQuestion = { prompt: string; options: string[]; correctIndex: number };

export async function createQuiz(
  db: DB,
  input: {
    organizationId: number;
    mentorUserId: number;
    learnerUserId: number;
    title: string;
    questions: NewQuestion[];
  },
) {
  const [res] = await db.insert(quizzes).values({
    organizationId: input.organizationId,
    mentorUserId: input.mentorUserId,
    learnerUserId: input.learnerUserId,
    title: input.title,
  });
  const quizId = res.insertId;
  if (input.questions.length > 0) {
    await db.insert(quizQuestions).values(
      input.questions.map((q, i) => ({
        quizId,
        prompt: q.prompt,
        options: JSON.stringify(q.options),
        correctIndex: q.correctIndex,
        position: i,
      })),
    );
  }
  return quizId;
}

/** Quizzes for a learner, each with question count + the learner's latest score. */
export async function getQuizzesForLearner(db: DB, organizationId: number, learnerUserId: number) {
  const rows = await db
    .select()
    .from(quizzes)
    .where(and(eq(quizzes.organizationId, organizationId), eq(quizzes.learnerUserId, learnerUserId)))
    .orderBy(desc(quizzes.createdAt));
  if (rows.length === 0) return [];

  const quizIds = rows.map((q) => q.id);
  const questions = await db
    .select({ quizId: quizQuestions.quizId })
    .from(quizQuestions)
    .where(inArray(quizQuestions.quizId, quizIds));
  const attempts = await db
    .select()
    .from(quizAttempts)
    .where(
      and(inArray(quizAttempts.quizId, quizIds), eq(quizAttempts.learnerUserId, learnerUserId)),
    )
    .orderBy(desc(quizAttempts.submittedAt));

  const counts = new Map<number, number>();
  for (const q of questions) counts.set(q.quizId, (counts.get(q.quizId) ?? 0) + 1);
  const latest = new Map<number, (typeof attempts)[number]>();
  for (const a of attempts) if (!latest.has(a.quizId)) latest.set(a.quizId, a);

  return rows.map((q) => ({
    id: q.id,
    title: q.title,
    questionCount: counts.get(q.id) ?? 0,
    score: latest.get(q.id)?.score ?? null,
    taken: latest.has(q.id),
  }));
}

async function loadQuestions(db: DB, quizId: number) {
  const qs = await db
    .select()
    .from(quizQuestions)
    .where(eq(quizQuestions.quizId, quizId))
    .orderBy(asc(quizQuestions.position));
  return qs.map((q) => ({
    id: q.id,
    prompt: q.prompt,
    options: JSON.parse(q.options) as string[],
    correctIndex: q.correctIndex,
  }));
}

/** For the learner taking the quiz — correct answers are NOT included. */
export async function getQuizForTaking(
  db: DB,
  organizationId: number,
  quizId: number,
  learnerUserId: number,
) {
  const rows = await db
    .select()
    .from(quizzes)
    .where(
      and(
        eq(quizzes.id, quizId),
        eq(quizzes.organizationId, organizationId),
        eq(quizzes.learnerUserId, learnerUserId),
      ),
    );
  const quiz = rows[0];
  if (!quiz) return null;
  const questions = await loadQuestions(db, quizId);
  return {
    id: quiz.id,
    title: quiz.title,
    questions: questions.map((q) => ({ id: q.id, prompt: q.prompt, options: q.options })),
  };
}

/** Grade a submission server-side and record the attempt. */
export async function submitAttempt(
  db: DB,
  organizationId: number,
  quizId: number,
  learnerUserId: number,
  answers: number[],
) {
  const rows = await db
    .select()
    .from(quizzes)
    .where(
      and(
        eq(quizzes.id, quizId),
        eq(quizzes.organizationId, organizationId),
        eq(quizzes.learnerUserId, learnerUserId),
      ),
    );
  if (!rows[0]) throw new Error("Quiz not found");

  const questions = await loadQuestions(db, quizId);
  const total = questions.length;
  let correct = 0;
  questions.forEach((q, i) => {
    if (answers[i] === q.correctIndex) correct += 1;
  });
  const score = total > 0 ? Math.round((correct / total) * 100) : 0;

  await db.insert(quizAttempts).values({
    quizId,
    learnerUserId,
    answers: JSON.stringify(answers),
    correctCount: correct,
    totalCount: total,
    score,
  });

  // Per-question breakdown — safe to reveal now that the attempt is recorded.
  const review = questions.map((q, i) => ({
    prompt: q.prompt,
    options: q.options,
    yourIndex: answers[i] ?? -1,
    correctIndex: q.correctIndex,
  }));
  return { score, correctCount: correct, totalCount: total, review };
}

export async function deleteQuiz(
  db: DB,
  organizationId: number,
  quizId: number,
  mentorUserId: number,
) {
  const rows = await db
    .select()
    .from(quizzes)
    .where(
      and(
        eq(quizzes.id, quizId),
        eq(quizzes.organizationId, organizationId),
        eq(quizzes.mentorUserId, mentorUserId),
      ),
    );
  if (!rows[0]) return { ok: true };
  await db.delete(quizAttempts).where(eq(quizAttempts.quizId, quizId));
  await db.delete(quizQuestions).where(eq(quizQuestions.quizId, quizId));
  await db.delete(quizzes).where(eq(quizzes.id, quizId));
  return { ok: true };
}
