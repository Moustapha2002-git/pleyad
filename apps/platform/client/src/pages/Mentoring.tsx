import { useState } from "react";
import {
  CalendarClock,
  Check,
  ClipboardCheck,
  GraduationCap,
  ListChecks,
  MessageSquareQuote,
  Video,
} from "lucide-react";
import { trpc } from "../lib/trpc";
import { useToast } from "../components/Toast";
import { VideoCall } from "../components/VideoCall";
import { MessageThread } from "../components/MessageThread";
import { QuizTaker } from "../components/QuizTaker";
import { callRoomName } from "../lib/room";
import { Avatar, Button, Card, EmptyState, PageHeader, Spinner, cn } from "../components/ui";

const dueTime = (d: string | Date | null) => (d ? new Date(d).getTime() : Infinity);
const isOverdue = (d: string | Date | null) => !!d && new Date(d).getTime() < Date.now();
function dueLabel(dueAt: string | Date | null) {
  if (!dueAt) return null;
  return new Date(dueAt).toLocaleDateString(undefined, { month: "short", day: "numeric" });
}
const sessionWhen = (d: string | Date) => {
  const x = new Date(d);
  const day = x.toDateString() === new Date().toDateString()
    ? "Today"
    : x.toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" });
  return `${day} · ${x.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" })}`;
};

const TABS = [
  { key: "overview", label: "Overview" },
  { key: "tasks", label: "Tasks" },
  { key: "quizzes", label: "Quizzes" },
  { key: "messages", label: "Messages" },
] as const;
type Tab = (typeof TABS)[number]["key"];

export default function Mentoring() {
  const me = trpc.auth.me.useQuery();
  const mentors = trpc.mentor.myMentors.useQuery();
  const utils = trpc.useUtils();
  const toast = useToast();
  const tasks = trpc.coaching.myTasks.useQuery();
  const feedback = trpc.coaching.myFeedback.useQuery();
  const quizzes = trpc.quizzes.mine.useQuery();
  const sessions = trpc.sessions.mine.useQuery();

  const [tab, setTab] = useState<Tab>("overview");
  const [takingQuiz, setTakingQuiz] = useState<number | null>(null);
  const [inCall, setInCall] = useState(false);
  const [selectedMentorId, setSelectedMentorId] = useState<number | null>(null);

  const setTaskDone = trpc.coaching.setTaskDone.useMutation({
    onSuccess: () => utils.coaching.myTasks.invalidate(),
    onError: (e) => toast.error(e.message),
  });
  const ring = trpc.calls.ring.useMutation();
  const cancel = trpc.calls.cancel.useMutation();

  const orgPublicId = me.data?.activeOrganization?.publicId ?? "";
  const myId = me.data?.id ?? 0;
  const myName = me.data?.name ?? me.data?.email ?? "Learner";
  // A learner may have more than one mentor; let them switch which one is active.
  const allMentors = mentors.data ?? [];
  const mentor = allMentors.find((m) => m.id === selectedMentorId) ?? allMentors[0];

  const room = mentor ? callRoomName(orgPublicId, myId, mentor.id) : "";
  const startCall = () => {
    if (mentor) ring.mutate({ toUserId: mentor.id, room });
    setInCall(true);
  };
  const endCall = () => {
    if (mentor) cancel.mutate({ toUserId: mentor.id });
    setInCall(false);
  };

  const nextSession = (sessions.data ?? [])
    .filter((s) => new Date(s.scheduledAt).getTime() > Date.now() - 30 * 60000)
    .sort((a, b) => new Date(a.scheduledAt).getTime() - new Date(b.scheduledAt).getTime())[0];

  const sortedTasks = [...(tasks.data ?? [])].sort((a, b) => {
    if ((a.status === "done") !== (b.status === "done")) return a.status === "done" ? 1 : -1;
    return dueTime(a.dueAt) - dueTime(b.dueAt);
  });
  const openTaskCount = (tasks.data ?? []).filter((t) => t.status !== "done").length;

  if (mentors.isLoading) {
    return (
      <div className="space-y-6">
        <PageHeader title="Mentoring" subtitle="Your mentor in this workspace." />
        <Spinner label="Loading…" />
      </div>
    );
  }

  if (!mentor) {
    return (
      <div className="space-y-6">
        <PageHeader title="Mentoring" subtitle="Your mentor in this workspace." />
        <EmptyState
          icon={GraduationCap}
          title="No mentor assigned yet"
          description="When a mentor is assigned to you, they'll appear here."
        />
      </div>
    );
  }

  const tabCount: Partial<Record<Tab, number>> = {
    tasks: openTaskCount,
    quizzes: quizzes.data?.length ?? 0,
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Mentoring"
        subtitle={
          allMentors.length > 1
            ? `You have ${allMentors.length} mentors in this workspace.`
            : "Your mentor in this workspace."
        }
      />

      {/* Mentor switcher — only when the learner has more than one mentor */}
      {allMentors.length > 1 && (
        <div className="flex flex-wrap gap-2">
          {allMentors.map((m) => {
            const active = m.id === mentor.id;
            return (
              <button
                key={m.id}
                onClick={() => setSelectedMentorId(m.id)}
                className={cn(
                  "flex items-center gap-2 rounded-full border px-3 py-1.5 text-sm font-medium transition",
                  active
                    ? "border-navy-900 bg-navy-900 text-white"
                    : "border-gray-200 text-ink/70 hover:border-navy/40",
                )}
              >
                <Avatar name={m.name ?? m.email ?? "?"} className="h-6 w-6 text-[10px]" />
                {m.name ?? m.email}
              </button>
            );
          })}
        </div>
      )}

      {/* Mentor header */}
      <Card className="flex flex-wrap items-center justify-between gap-4 p-5">
        <div className="flex items-center gap-3">
          <Avatar name={mentor.name ?? mentor.email ?? "?"} className="h-12 w-12 text-sm" />
          <div className="min-w-0">
            <div className="font-semibold text-navy-900">{mentor.name ?? mentor.email}</div>
            <div className="truncate text-sm text-ink/50">
              {mentor.profile?.headline ?? "Your mentor"}
            </div>
            {(mentor.profile?.expertise.length ?? 0) > 0 && (
              <div className="mt-1.5 flex flex-wrap gap-1.5">
                {mentor.profile!.expertise.slice(0, 4).map((tag) => (
                  <span
                    key={tag}
                    className="rounded-full bg-navy/5 px-2 py-0.5 text-[11px] font-medium text-navy/70"
                  >
                    {tag}
                  </span>
                ))}
              </div>
            )}
          </div>
        </div>
        <Button icon={Video} onClick={startCall}>
          Video call
        </Button>
      </Card>

      {inCall && (
        <VideoCall room={room} displayName={myName} onClose={endCall} />
      )}

      {/* Tab bar */}
      <div className="flex flex-wrap gap-1 border-b border-gray-200">
        {TABS.map((t) => {
          const active = tab === t.key;
          const count = tabCount[t.key];
          return (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className={cn(
                "-mb-px flex items-center gap-1.5 border-b-2 px-3.5 py-2.5 text-sm font-medium transition",
                active
                  ? "border-navy-900 text-navy-900"
                  : "border-transparent text-ink/55 hover:text-navy",
              )}
            >
              {t.label}
              {count != null && count > 0 && (
                <span
                  className={cn(
                    "rounded-full px-1.5 text-[11px] font-semibold",
                    active ? "bg-navy-900 text-white" : "bg-gray-100 text-ink/50",
                  )}
                >
                  {count}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* ── Overview ─────────────────────────────────────────────────── */}
      {tab === "overview" && (
        <div className="space-y-6">
          {/* Next session */}
          {nextSession ? (
            <Card className="flex flex-wrap items-center justify-between gap-4 border-gold/30 bg-gold/[0.06] p-5">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gold/15 text-gold">
                  <CalendarClock className="h-5 w-5" />
                </div>
                <div>
                  <div className="text-[11px] font-semibold uppercase tracking-wide text-gold">
                    Next session
                  </div>
                  <div className="font-semibold text-navy-900">{nextSession.title}</div>
                  <div className="text-sm text-ink/55">{sessionWhen(nextSession.scheduledAt)}</div>
                </div>
              </div>
              <Button icon={Video} onClick={startCall}>
                Join
              </Button>
            </Card>
          ) : (
            <Card className="p-5 text-sm text-ink/55">
              No sessions scheduled yet — your mentor will set one up.
            </Card>
          )}

          {/* Feedback */}
          <Card className="p-6">
            <h2 className="mb-4 flex items-center gap-2 text-base font-semibold text-navy-900">
              <MessageSquareQuote className="h-4 w-4" /> Feedback from your mentor
            </h2>
            {feedback.data && feedback.data.length > 0 ? (
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
            ) : (
              <p className="text-sm text-ink/50">No feedback yet.</p>
            )}
          </Card>
        </div>
      )}

      {/* ── Tasks ────────────────────────────────────────────────────── */}
      {tab === "tasks" && (
        <Card className="p-6">
          <h2 className="mb-4 flex items-center gap-2 text-base font-semibold text-navy-900">
            <ClipboardCheck className="h-4 w-4" /> Your tasks
          </h2>
          {sortedTasks.length > 0 ? (
            <ul className="space-y-2">
              {sortedTasks.map((t) => (
                <li
                  key={t.id}
                  className="flex items-start gap-3 rounded-xl border border-gray-100 p-3"
                >
                  <button
                    onClick={() => setTaskDone.mutate({ taskId: t.id, done: t.status !== "done" })}
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
                        <span
                          className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                            isOverdue(t.dueAt) ? "bg-red-500/12 text-red-600" : "bg-gold/15 text-gold"
                          }`}
                        >
                          {isOverdue(t.dueAt) ? "Overdue" : `Due ${dueLabel(t.dueAt)}`}
                        </span>
                      )}
                    </div>
                    {t.instructions && <p className="mt-1 text-sm text-ink/60">{t.instructions}</p>}
                  </div>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-ink/50">No tasks yet.</p>
          )}
        </Card>
      )}

      {/* ── Quizzes ──────────────────────────────────────────────────── */}
      {tab === "quizzes" && (
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
      )}

      {/* ── Messages ─────────────────────────────────────────────────── */}
      {tab === "messages" && (
        <MessageThread withUserId={mentor.id} title={`Messages with ${mentor.name ?? "your mentor"}`} />
      )}
    </div>
  );
}
