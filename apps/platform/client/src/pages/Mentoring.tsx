import { useState } from "react";
import {
  Check,
  ClipboardCheck,
  GraduationCap,
  ListChecks,
  MessageSquareQuote,
  Video,
} from "lucide-react";
import { trpc } from "../lib/trpc";
import { VideoCall } from "../components/VideoCall";
import { MessageThread } from "../components/MessageThread";
import { QuizTaker } from "../components/QuizTaker";
import { callRoomName } from "../lib/room";
import { Avatar, Button, Card, EmptyState, PageHeader, Spinner } from "../components/ui";

function dueLabel(dueAt: string | Date | null) {
  if (!dueAt) return null;
  return new Date(dueAt).toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

export default function Mentoring() {
  const me = trpc.auth.me.useQuery();
  const mentors = trpc.mentor.myMentors.useQuery();
  const utils = trpc.useUtils();
  const tasks = trpc.coaching.myTasks.useQuery();
  const feedback = trpc.coaching.myFeedback.useQuery();
  const quizzes = trpc.quizzes.mine.useQuery();
  const [takingQuiz, setTakingQuiz] = useState<number | null>(null);
  const setTaskDone = trpc.coaching.setTaskDone.useMutation({
    onSuccess: () => utils.coaching.myTasks.invalidate(),
  });
  const ring = trpc.calls.ring.useMutation();
  const cancel = trpc.calls.cancel.useMutation();
  const [inCall, setInCall] = useState(false);

  const orgPublicId = me.data?.activeOrganization?.publicId ?? "";
  const myId = me.data?.id ?? 0;
  const myName = me.data?.name ?? me.data?.email ?? "Learner";
  const mentor = mentors.data?.[0];

  return (
    <div className="space-y-6">
      <PageHeader title="Mentoring" subtitle="Your mentor in this workspace." />

      {mentors.isLoading ? (
        <Spinner label="Loading…" />
      ) : mentor ? (
        <>
          <Card className="flex flex-wrap items-center justify-between gap-4 p-5">
            <div className="flex items-center gap-3">
              <Avatar name={mentor.name ?? mentor.email ?? "?"} className="h-12 w-12 text-sm" />
              <div>
                <div className="font-semibold text-navy-900">{mentor.name ?? mentor.email}</div>
                <div className="text-sm text-ink/50">Your mentor</div>
              </div>
            </div>
            <Button
              icon={Video}
              onClick={() => {
                ring.mutate({
                  toUserId: mentor.id,
                  room: callRoomName(orgPublicId, myId, mentor.id),
                });
                setInCall(true);
              }}
            >
              Video call
            </Button>
          </Card>

          {inCall && (
            <VideoCall
              room={callRoomName(orgPublicId, myId, mentor.id)}
              displayName={myName}
              onClose={() => {
                cancel.mutate({ toUserId: mentor.id });
                setInCall(false);
              }}
            />
          )}

          {/* Your tasks */}
          <Card className="p-6">
            <h2 className="mb-4 flex items-center gap-2 text-base font-semibold text-navy-900">
              <ClipboardCheck className="h-4 w-4" /> Your tasks
            </h2>
            {tasks.data && tasks.data.length > 0 ? (
              <ul className="space-y-2">
                {tasks.data.map((t) => (
                  <li
                    key={t.id}
                    className="flex items-start gap-3 rounded-xl border border-gray-100 p-3"
                  >
                    <button
                      onClick={() =>
                        setTaskDone.mutate({ taskId: t.id, done: t.status !== "done" })
                      }
                      className={`mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-md border transition ${
                        t.status === "done"
                          ? "border-navy-900 bg-navy-900 text-white"
                          : "border-gray-300 text-transparent hover:border-navy/50"
                      }`}
                      aria-label="Toggle done"
                    >
                      <Check className="h-4 w-4" />
                    </button>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span
                          className={
                            t.status === "done"
                              ? "font-medium text-ink/40 line-through"
                              : "font-medium text-navy-900"
                          }
                        >
                          {t.title}
                        </span>
                        {t.status !== "done" && dueLabel(t.dueAt) && (
                          <span className="rounded-full bg-gold/15 px-2 py-0.5 text-xs font-medium text-gold">
                            Due {dueLabel(t.dueAt)}
                          </span>
                        )}
                      </div>
                      {t.instructions && (
                        <p className="mt-1 text-sm text-ink/60">{t.instructions}</p>
                      )}
                    </div>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-ink/50">No tasks yet.</p>
            )}
          </Card>

          {/* Feedback from your mentor */}
          {feedback.data && feedback.data.length > 0 && (
            <Card className="p-6">
              <h2 className="mb-4 flex items-center gap-2 text-base font-semibold text-navy-900">
                <MessageSquareQuote className="h-4 w-4" /> Feedback from your mentor
              </h2>
              <div className="space-y-2">
                {feedback.data.map((f) => (
                  <div key={f.id} className="rounded-xl border border-gray-100 p-3">
                    <p className="text-sm text-ink">{f.body}</p>
                    <p className="mt-1 text-xs text-ink/40">
                      {f.mentorName ?? "Mentor"} · {new Date(f.createdAt).toLocaleDateString()}
                    </p>
                  </div>
                ))}
              </div>
            </Card>
          )}

          {/* Quizzes */}
          <Card className="p-6">
            <h2 className="mb-4 flex items-center gap-2 text-base font-semibold text-navy-900">
              <ListChecks className="h-4 w-4" /> Quizzes
            </h2>
            {takingQuiz !== null ? (
              <QuizTaker
                quizId={takingQuiz}
                onClose={() => {
                  setTakingQuiz(null);
                  utils.quizzes.mine.invalidate();
                }}
              />
            ) : quizzes.data && quizzes.data.length > 0 ? (
              <div className="space-y-2">
                {quizzes.data.map((q) => (
                  <div
                    key={q.id}
                    className="flex items-center gap-3 rounded-xl border border-gray-100 p-3"
                  >
                    <div className="min-w-0 flex-1">
                      <span className="font-medium text-navy-900">{q.title}</span>
                      <span className="ml-2 text-sm text-ink/50">
                        {q.questionCount} question{q.questionCount === 1 ? "" : "s"}
                      </span>
                    </div>
                    {q.taken && (
                      <span className="rounded-full bg-dim-skills/10 px-2 py-0.5 text-xs font-medium text-dim-skills">
                        Score {q.score}%
                      </span>
                    )}
                    <Button variant="secondary" onClick={() => setTakingQuiz(q.id)}>
                      {q.taken ? "Retake" : "Take"}
                    </Button>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-ink/50">No quizzes yet.</p>
            )}
          </Card>

          <MessageThread
            withUserId={mentor.id}
            title={`Messages with ${mentor.name ?? "your mentor"}`}
          />
        </>
      ) : (
        <EmptyState
          icon={GraduationCap}
          title="No mentor assigned yet"
          description="When a mentor is assigned to you, they'll appear here."
        />
      )}
    </div>
  );
}
