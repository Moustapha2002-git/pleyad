import { useState } from "react";
import {
  ArrowLeft,
  CalendarPlus,
  ClipboardCheck,
  ClipboardList,
  ListChecks,
  MessageSquareQuote,
  Trash2,
  Video,
  X,
} from "lucide-react";
import { Link } from "wouter";
import { trpc } from "../lib/trpc";
import { useToast } from "../components/Toast";
import { DimensionGauges } from "../components/DimensionGauges";
import { VideoCall } from "../components/VideoCall";
import { MessageThread } from "../components/MessageThread";
import { QuizBuilder } from "../components/QuizBuilder";
import { callRoomName } from "../lib/room";
import {
  Avatar,
  Button,
  Card,
  ProgressBar,
  Select,
  Spinner,
  Textarea,
  TextInput,
  cn,
} from "../components/ui";

function dueLabel(dueAt: string | Date | null) {
  if (!dueAt) return null;
  return new Date(dueAt).toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

const TABS = [
  { key: "overview", label: "Overview" },
  { key: "paths", label: "Paths" },
  { key: "tasks", label: "Tasks" },
  { key: "feedback", label: "Feedback" },
  { key: "quizzes", label: "Quizzes" },
  { key: "messages", label: "Messages" },
] as const;
type Tab = (typeof TABS)[number]["key"];

export default function LearnerProfile({ learnerId }: { learnerId: number }) {
  const me = trpc.auth.me.useQuery();
  const profile = trpc.mentor.learnerProfile.useQuery({ learnerId });
  const orgPaths = trpc.paths.list.useQuery();
  const assigned = trpc.paths.assignedTo.useQuery({ learnerUserId: learnerId });
  const utils = trpc.useUtils();
  const toast = useToast();

  const [tab, setTab] = useState<Tab>("overview");

  const ring = trpc.calls.ring.useMutation();
  const cancel = trpc.calls.cancel.useMutation();
  const [inCall, setInCall] = useState(false);

  // Scheduling
  const [sessTitle, setSessTitle] = useState("Mentoring session");
  const [sessWhen, setSessWhen] = useState("");
  const [sessDuration, setSessDuration] = useState(30);
  const schedule = trpc.sessions.schedule.useMutation({
    onSuccess: () => {
      setSessWhen("");
      utils.sessions.mine.invalidate();
      toast.success("Session scheduled");
    },
    onError: (e) => toast.error(e.message),
  });

  // Assigning paths
  const [assignPathId, setAssignPathId] = useState("");
  const [assignDue, setAssignDue] = useState("");
  const refreshAssignments = () => {
    utils.paths.assignedTo.invalidate({ learnerUserId: learnerId });
  };
  const assignPath = trpc.paths.assign.useMutation({
    onSuccess: () => {
      setAssignPathId("");
      setAssignDue("");
      refreshAssignments();
      toast.success("Path assigned");
    },
    onError: (e) => toast.error(e.message),
  });
  const unassignPath = trpc.paths.unassign.useMutation({
    onSuccess: () => {
      refreshAssignments();
      toast.info("Path unassigned");
    },
    onError: (e) => toast.error(e.message),
  });

  // Tasks & feedback
  const tasks = trpc.coaching.tasksFor.useQuery({ learnerUserId: learnerId });
  const feedback = trpc.coaching.feedbackFor.useQuery({ learnerUserId: learnerId });
  const [taskTitle, setTaskTitle] = useState("");
  const [taskInstr, setTaskInstr] = useState("");
  const [taskDue, setTaskDue] = useState("");
  const [fbBody, setFbBody] = useState("");
  const createTask = trpc.coaching.createTask.useMutation({
    onSuccess: () => {
      setTaskTitle("");
      setTaskInstr("");
      setTaskDue("");
      utils.coaching.tasksFor.invalidate({ learnerUserId: learnerId });
      toast.success("Task added");
    },
    onError: (e) => toast.error(e.message),
  });
  const deleteTask = trpc.coaching.deleteTask.useMutation({
    onSuccess: () => {
      utils.coaching.tasksFor.invalidate({ learnerUserId: learnerId });
      toast.info("Task deleted");
    },
    onError: (e) => toast.error(e.message),
  });
  const addFeedback = trpc.coaching.addFeedback.useMutation({
    onSuccess: () => {
      setFbBody("");
      utils.coaching.feedbackFor.invalidate({ learnerUserId: learnerId });
      toast.success("Feedback sent");
    },
    onError: (e) => toast.error(e.message),
  });

  // Quizzes
  const quizzes = trpc.quizzes.forLearner.useQuery({ learnerUserId: learnerId });
  const [showQuiz, setShowQuiz] = useState(false);
  const deleteQuiz = trpc.quizzes.delete.useMutation({
    onSuccess: () => {
      utils.quizzes.forLearner.invalidate({ learnerUserId: learnerId });
      toast.info("Quiz deleted");
    },
    onError: (e) => toast.error(e.message),
  });

  const room = me.data
    ? callRoomName(me.data.activeOrganization?.publicId ?? "", me.data.id, learnerId)
    : "";
  const startCall = () => {
    if (room) ring.mutate({ toUserId: learnerId, room });
    setInCall(true);
  };
  const endCall = () => {
    cancel.mutate({ toUserId: learnerId });
    setInCall(false);
  };

  if (profile.isLoading) return <Spinner label="Loading…" />;
  if (!profile.data) return <p className="text-ink/50">Not found.</p>;
  const p = profile.data;
  const name = p.learner.name ?? p.learner.email ?? "Learner";

  const assignedPaths = assigned.data ?? [];
  const assignedIds = new Set(assignedPaths.map((a) => a.id));
  const available = (orgPaths.data ?? []).filter((op) => !assignedIds.has(op.id));

  // Small badges on the tab labels (open tasks, unread etc.)
  const openTasks = (tasks.data ?? []).filter((t) => t.status !== "done").length;
  const tabCount: Partial<Record<Tab, number>> = {
    paths: assignedPaths.length,
    tasks: openTasks,
    quizzes: quizzes.data?.length ?? 0,
  };

  return (
    <div className="space-y-6">
      <Link
        to="/mentor"
        className="inline-flex items-center gap-1 text-sm text-navy/60 transition hover:text-navy"
      >
        <ArrowLeft className="h-4 w-4" /> My learners
      </Link>

      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <Avatar name={name} className="h-12 w-12 text-sm" />
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-navy-900">{name}</h1>
            <p className="text-ink/50">{p.learner.email}</p>
          </div>
        </div>
        <Button icon={Video} onClick={startCall}>
          Video call
        </Button>
      </div>

      {inCall && me.data && (
        <VideoCall
          room={room}
          displayName={me.data.name ?? me.data.email ?? "Mentor"}
          onClose={endCall}
        />
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
          {/* Account facts (registration, sign-in, membership status) */}
          <Card className="grid grid-cols-2 gap-4 p-5 sm:grid-cols-4">
            {[
              {
                label: "Registered",
                value: new Date(p.learner.registeredAt).toLocaleDateString(undefined, {
                  month: "short",
                  day: "numeric",
                  year: "numeric",
                }),
              },
              {
                label: "Last sign-in",
                value: p.learner.lastSignedInAt
                  ? new Date(p.learner.lastSignedInAt).toLocaleDateString(undefined, {
                      month: "short",
                      day: "numeric",
                    })
                  : "Never",
              },
              {
                label: "Joined workspace",
                value: p.learner.joinedAt
                  ? new Date(p.learner.joinedAt).toLocaleDateString(undefined, {
                      month: "short",
                      day: "numeric",
                      year: "numeric",
                    })
                  : "—",
              },
              {
                label: "Status",
                value:
                  p.learner.membershipStatus === "suspended"
                    ? "Suspended"
                    : p.learner.membershipStatus === "active"
                      ? "Active"
                      : (p.learner.membershipStatus ?? "—"),
              },
            ].map((f) => (
              <div key={f.label}>
                <div className="text-[11px] font-semibold uppercase tracking-wide text-ink/40">
                  {f.label}
                </div>
                <div
                  className={
                    f.value === "Suspended"
                      ? "mt-0.5 text-sm font-semibold text-red-600"
                      : "mt-0.5 text-sm font-semibold text-navy-900"
                  }
                >
                  {f.value}
                </div>
              </div>
            ))}
          </Card>

          <section>
            <h2 className="mb-3 text-xs font-semibold uppercase tracking-wider text-gold">
              Progress CV
            </h2>
            <DimensionGauges data={p.progression} />
          </section>

          <Card className="p-6">
            <h2 className="mb-4 flex items-center gap-2 text-base font-semibold text-navy-900">
              <CalendarPlus className="h-4 w-4" /> Schedule a session
            </h2>
            <form
              onSubmit={(e) => {
                e.preventDefault();
                if (sessWhen)
                  schedule.mutate({
                    learnerUserId: learnerId,
                    title: sessTitle.trim() || "Mentoring session",
                    scheduledAt: sessWhen,
                    durationMinutes: sessDuration,
                  });
              }}
              className="flex flex-col gap-3 sm:flex-row sm:items-end"
            >
              <label className="flex-1 text-sm">
                <span className="mb-1 block font-medium text-ink/80">Title</span>
                <TextInput value={sessTitle} onChange={(e) => setSessTitle(e.target.value)} />
              </label>
              <label className="text-sm">
                <span className="mb-1 block font-medium text-ink/80">When</span>
                <TextInput
                  type="datetime-local"
                  value={sessWhen}
                  onChange={(e) => setSessWhen(e.target.value)}
                />
              </label>
              <label className="text-sm">
                <span className="mb-1 block font-medium text-ink/80">Minutes</span>
                <Select
                  value={String(sessDuration)}
                  onChange={(e) => setSessDuration(Number(e.target.value))}
                >
                  <option value="15">15</option>
                  <option value="30">30</option>
                  <option value="45">45</option>
                  <option value="60">60</option>
                </Select>
              </label>
              <Button type="submit" disabled={schedule.isPending || !sessWhen}>
                Schedule
              </Button>
            </form>
          </Card>
        </div>
      )}

      {/* ── Paths ────────────────────────────────────────────────────── */}
      {tab === "paths" && (
        <Card className="p-6">
          <h2 className="mb-4 flex items-center gap-2 text-base font-semibold text-navy-900">
            <ClipboardList className="h-4 w-4" /> Assigned learning paths
          </h2>

          {assignedPaths.length > 0 ? (
            <div className="mb-4 space-y-2">
              {assignedPaths.map((path) => (
                <div
                  key={path.id}
                  className="flex items-center gap-3 rounded-xl border border-gray-100 p-3"
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-navy-900">{path.title}</span>
                      {dueLabel(path.dueAt) && (
                        <span className="rounded-full bg-gold/15 px-2 py-0.5 text-xs font-medium text-gold">
                          Due {dueLabel(path.dueAt)}
                        </span>
                      )}
                    </div>
                    <ProgressBar value={path.progress} className="mt-2" />
                  </div>
                  <span className="text-sm text-ink/50">{path.progress}%</span>
                  <button
                    onClick={() =>
                      unassignPath.mutate({ collectionId: path.id, learnerUserId: learnerId })
                    }
                    className="rounded-lg border border-gray-200 p-2 text-ink/50 transition hover:bg-gray-50"
                    aria-label="Unassign"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>
              ))}
            </div>
          ) : (
            <p className="mb-4 text-sm text-ink/50">No paths assigned yet.</p>
          )}

          <form
            onSubmit={(e) => {
              e.preventDefault();
              if (assignPathId)
                assignPath.mutate({
                  collectionId: Number(assignPathId),
                  learnerUserId: learnerId,
                  dueAt: assignDue || null,
                });
            }}
            className="flex flex-col gap-2 border-t border-gray-100 pt-4 sm:flex-row sm:items-end"
          >
            <label className="flex-1 text-sm">
              <span className="mb-1 block font-medium text-ink/80">Assign a path</span>
              <Select
                value={assignPathId}
                onChange={(e) => setAssignPathId(e.target.value)}
                className="w-full"
              >
                <option value="">Choose a path…</option>
                {available.map((op) => (
                  <option key={op.id} value={op.id}>
                    {op.title}
                  </option>
                ))}
              </Select>
            </label>
            <label className="text-sm">
              <span className="mb-1 block font-medium text-ink/80">Due (optional)</span>
              <TextInput
                type="date"
                value={assignDue}
                onChange={(e) => setAssignDue(e.target.value)}
              />
            </label>
            <Button type="submit" disabled={!assignPathId || assignPath.isPending}>
              Assign
            </Button>
          </form>
        </Card>
      )}

      {/* ── Tasks ────────────────────────────────────────────────────── */}
      {tab === "tasks" && (
        <Card className="p-6">
          <h2 className="mb-4 flex items-center gap-2 text-base font-semibold text-navy-900">
            <ClipboardCheck className="h-4 w-4" /> Tasks & exercises
          </h2>
          {tasks.data && tasks.data.length > 0 ? (
            <div className="mb-4 space-y-2">
              {tasks.data.map((t) => (
                <div
                  key={t.id}
                  className="flex items-start gap-3 rounded-xl border border-gray-100 p-3"
                >
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
                      {t.status === "done" ? (
                        <span className="rounded-full bg-dim-skills/10 px-2 py-0.5 text-xs font-medium text-dim-skills">
                          Done
                        </span>
                      ) : dueLabel(t.dueAt) ? (
                        <span className="rounded-full bg-gold/15 px-2 py-0.5 text-xs font-medium text-gold">
                          Due {dueLabel(t.dueAt)}
                        </span>
                      ) : null}
                    </div>
                    {t.instructions && (
                      <p className="mt-1 text-sm text-ink/60">{t.instructions}</p>
                    )}
                  </div>
                  <button
                    onClick={() => deleteTask.mutate({ taskId: t.id })}
                    className="rounded-lg border border-gray-200 p-2 text-ink/50 transition hover:bg-gray-50"
                    aria-label="Delete task"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              ))}
            </div>
          ) : (
            <p className="mb-4 text-sm text-ink/50">No tasks yet.</p>
          )}
          <form
            onSubmit={(e) => {
              e.preventDefault();
              if (taskTitle.trim())
                createTask.mutate({
                  learnerUserId: learnerId,
                  title: taskTitle.trim(),
                  instructions: taskInstr.trim() || undefined,
                  dueAt: taskDue || null,
                });
            }}
            className="space-y-2 border-t border-gray-100 pt-4"
          >
            <div className="flex flex-col gap-2 sm:flex-row">
              <TextInput
                value={taskTitle}
                onChange={(e) => setTaskTitle(e.target.value)}
                placeholder="Task title (e.g. Build a to-do app)"
                className="min-w-0 sm:flex-1"
              />
              <TextInput
                type="date"
                value={taskDue}
                onChange={(e) => setTaskDue(e.target.value)}
                className="sm:w-44 sm:shrink-0"
              />
            </div>
            <Textarea
              value={taskInstr}
              onChange={(e) => setTaskInstr(e.target.value)}
              placeholder="Instructions (optional)"
              rows={2}
            />
            <Button type="submit" disabled={!taskTitle.trim() || createTask.isPending}>
              Add task
            </Button>
          </form>
        </Card>
      )}

      {/* ── Feedback ─────────────────────────────────────────────────── */}
      {tab === "feedback" && (
        <Card className="p-6">
          <h2 className="mb-4 flex items-center gap-2 text-base font-semibold text-navy-900">
            <MessageSquareQuote className="h-4 w-4" /> Feedback
          </h2>
          {feedback.data && feedback.data.length > 0 ? (
            <div className="mb-4 space-y-2">
              {feedback.data.map((f) => (
                <div key={f.id} className="rounded-xl border border-gray-100 p-3">
                  <p className="text-sm text-ink">{f.body}</p>
                  <p className="mt-1 text-xs text-ink/40">
                    {new Date(f.createdAt).toLocaleDateString()}
                  </p>
                </div>
              ))}
            </div>
          ) : (
            <p className="mb-4 text-sm text-ink/50">No feedback yet.</p>
          )}
          <form
            onSubmit={(e) => {
              e.preventDefault();
              if (fbBody.trim())
                addFeedback.mutate({ learnerUserId: learnerId, body: fbBody.trim() });
            }}
            className="space-y-2 border-t border-gray-100 pt-4"
          >
            <Textarea
              value={fbBody}
              onChange={(e) => setFbBody(e.target.value)}
              placeholder="Write official feedback for this learner…"
              rows={3}
            />
            <Button type="submit" disabled={!fbBody.trim() || addFeedback.isPending}>
              Give feedback
            </Button>
          </form>
        </Card>
      )}

      {/* ── Quizzes ──────────────────────────────────────────────────── */}
      {tab === "quizzes" && (
        <Card className="p-6">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="flex items-center gap-2 text-base font-semibold text-navy-900">
              <ListChecks className="h-4 w-4" /> Quizzes
            </h2>
            <Button variant="secondary" onClick={() => setShowQuiz((s) => !s)}>
              {showQuiz ? "Close" : "New quiz"}
            </Button>
          </div>
          {showQuiz && (
            <div className="mb-4">
              <QuizBuilder
                learnerId={learnerId}
                onCreated={() => {
                  setShowQuiz(false);
                  utils.quizzes.forLearner.invalidate({ learnerUserId: learnerId });
                }}
              />
            </div>
          )}
          {quizzes.data && quizzes.data.length > 0 ? (
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
                  {q.taken ? (
                    <span className="rounded-full bg-dim-skills/10 px-2 py-0.5 text-xs font-medium text-dim-skills">
                      Score {q.score}%
                    </span>
                  ) : (
                    <span className="rounded-full bg-gray-100 px-2 py-0.5 text-xs text-ink/50">
                      Not taken
                    </span>
                  )}
                  <button
                    onClick={() => deleteQuiz.mutate({ quizId: q.id })}
                    className="rounded-lg border border-gray-200 p-2 text-ink/50 transition hover:bg-gray-50"
                    aria-label="Delete quiz"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              ))}
            </div>
          ) : (
            !showQuiz && <p className="text-sm text-ink/50">No quizzes yet.</p>
          )}
        </Card>
      )}

      {/* ── Messages ─────────────────────────────────────────────────── */}
      {tab === "messages" && <MessageThread withUserId={learnerId} />}
    </div>
  );
}
