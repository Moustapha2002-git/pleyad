import { useState } from "react";
import {
  CalendarClock,
  Check,
  ChevronDown,
  ChevronRight,
  ClipboardCheck,
  GraduationCap,
  Languages,
  ListChecks,
  MessageSquare,
  MessageSquareQuote,
  Video,
} from "lucide-react";
import { trpc } from "../lib/trpc";
import { dateLocale, useT } from "../lib/i18n";
import { useToast } from "../components/Toast";
import { VideoCall } from "../components/VideoCall";
import { MessageThread } from "../components/MessageThread";
import { QuizTaker } from "../components/QuizTaker";
import { callRoomName } from "../lib/room";
import {
  Avatar,
  Button,
  Card,
  EmptyState,
  PageHeader,
  ProgressBar,
  Spinner,
  cn,
} from "../components/ui";

const dueTime = (d: string | Date | null) => (d ? new Date(d).getTime() : Infinity);
const isOverdue = (d: string | Date | null) => !!d && new Date(d).getTime() < Date.now();
function dueLabel(dueAt: string | Date | null) {
  if (!dueAt) return null;
  return new Date(dueAt).toLocaleDateString(dateLocale(), { month: "short", day: "numeric" });
}
const sessionWhen = (d: string | Date) => {
  const x = new Date(d);
  const day =
    x.toDateString() === new Date().toDateString()
      ? "Today"
      : x.toLocaleDateString(dateLocale(), { weekday: "short", month: "short", day: "numeric" });
  return `${day} · ${x.toLocaleTimeString(dateLocale(), { hour: "numeric", minute: "2-digit" })}`;
};

/** "live" while in progress, "soon" within 15 min of start, else null. */
function sessionState(s: { scheduledAt: string | Date; durationMinutes: number }) {
  const start = new Date(s.scheduledAt).getTime();
  const end = start + s.durationMinutes * 60_000;
  const now = Date.now();
  if (now >= start && now <= end) return "live" as const;
  if (now >= start - 15 * 60_000 && now < start) return "soon" as const;
  return null;
}

const TABS = [
  { key: "overview", labelKey: "tabOverview" },
  { key: "tasks", labelKey: "tabTasks" },
  { key: "quizzes", labelKey: "tabQuizzes" },
  { key: "messages", labelKey: "tabMessages" },
] as const;
type Tab = (typeof TABS)[number]["key"];

export default function Mentoring() {
  const { t } = useT();
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
  const [showBio, setShowBio] = useState(false);
  const [selectedMentorId, setSelectedMentorId] = useState<number | null>(null);

  const setTaskDone = trpc.coaching.setTaskDone.useMutation({
    onSuccess: (_r, vars) => {
      utils.coaching.myTasks.invalidate();
      if (vars.done) toast.success(t("mentoring.taskCompleted"));
    },
    onError: (e) => toast.error(e.message),
  });
  const ring = trpc.calls.ring.useMutation();
  const cancel = trpc.calls.cancel.useMutation();

  const orgPublicId = me.data?.activeOrganization?.publicId ?? "";
  const myId = me.data?.id ?? 0;
  const myName = me.data?.name ?? me.data?.email ?? t("roles.member");
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
  const sessState = nextSession ? sessionState(nextSession) : null;
  const minsToStart = nextSession
    ? Math.max(0, Math.round((new Date(nextSession.scheduledAt).getTime() - Date.now()) / 60_000))
    : 0;

  const sortedTasks = [...(tasks.data ?? [])].sort((a, b) => {
    if ((a.status === "done") !== (b.status === "done")) return a.status === "done" ? 1 : -1;
    return dueTime(a.dueAt) - dueTime(b.dueAt);
  });
  const doneTasks = (tasks.data ?? []).filter((t) => t.status === "done").length;
  const totalTasks = tasks.data?.length ?? 0;
  const openTaskCount = totalTasks - doneTasks;
  const quizzesToTake = (quizzes.data ?? []).filter((q) => !q.taken).length;
  const latestFeedback = feedback.data?.[0];

  if (mentors.isLoading) {
    return (
      <div className="space-y-6">
        <PageHeader title={t("mentoring.title")} subtitle={t("mentoring.subtitleWorkspace")} />
        <Spinner label={t("mentoring.loading")} />
      </div>
    );
  }

  if (!mentor) {
    return (
      <div className="space-y-6">
        <PageHeader title={t("mentoring.title")} subtitle={t("mentoring.subtitleWorkspace")} />
        <EmptyState
          icon={GraduationCap}
          title={t("mentoring.noMentorTitle")}
          description={t("mentoring.noMentorDesc")}
        />
      </div>
    );
  }

  const p = mentor.profile;
  const tabCount: Partial<Record<Tab, number>> = {
    tasks: openTaskCount,
    quizzes: quizzesToTake,
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title={t("mentoring.title")}
        subtitle={
          allMentors.length > 1
            ? t("mentoring.subtitleMany", { n: allMentors.length })
            : t("mentoring.subtitleOne")
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

      {/* ── Mentor hero ─────────────────────────────────────────────── */}
      <Card className="overflow-hidden">
        <div className="bg-navy-950 px-5 pb-12 pt-5">
          <div className="text-[10px] font-bold uppercase tracking-[0.25em] text-white/40">
            {t("mentoring.yourMentor")}
          </div>
        </div>
        <div className="px-5 pb-5">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div className="flex items-end gap-3">
              <Avatar
                name={mentor.name ?? mentor.email ?? "?"}
                className="-mt-8 h-16 w-16 border-4 border-white text-lg shadow-[var(--shadow-card)]"
              />
              <div className="pt-2">
                <div className="text-lg font-bold leading-tight text-navy-900">
                  {mentor.name ?? mentor.email}
                </div>
                {p?.headline && <div className="text-sm text-ink/55">{p.headline}</div>}
              </div>
            </div>
            <div className="flex gap-2 pt-2">
              <Button variant="secondary" icon={MessageSquare} onClick={() => setTab("messages")}>
                {t("mentoring.message")}
              </Button>
              <Button icon={Video} onClick={startCall}>
                {t("mentoring.videoCall")}
              </Button>
            </div>
          </div>

          {((p?.expertise.length ?? 0) > 0 ||
            (p?.languages.length ?? 0) > 0 ||
            p?.availabilityNote) && (
            <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-2 text-xs text-ink/55">
              {(p?.expertise.length ?? 0) > 0 && (
                <div className="flex flex-wrap gap-1.5">
                  {p!.expertise.slice(0, 5).map((tag) => (
                    <span
                      key={tag}
                      className="rounded-full bg-navy/5 px-2.5 py-0.5 text-xs font-medium text-navy/70"
                    >
                      {tag}
                    </span>
                  ))}
                </div>
              )}
              {(p?.languages.length ?? 0) > 0 && (
                <span className="inline-flex items-center gap-1">
                  <Languages className="h-3.5 w-3.5" /> {p!.languages.join(" · ")}
                </span>
              )}
              {p?.availabilityNote && (
                <span className="inline-flex items-center gap-1">
                  <CalendarClock className="h-3.5 w-3.5" /> {p.availabilityNote}
                </span>
              )}
            </div>
          )}

          {p?.bio && (
            <div className="mt-3">
              <button
                onClick={() => setShowBio((s) => !s)}
                aria-expanded={showBio}
                className="inline-flex items-center gap-1 text-xs font-medium text-navy/60 transition hover:text-navy"
              >
                {t("mentoring.about", { name: mentor.name?.split(" ")[0] ?? t("mentoring.yourMentorFallback") })}
                <ChevronDown
                  className={cn("h-3.5 w-3.5 transition-transform", showBio && "rotate-180")}
                />
              </button>
              {showBio && (
                <p className="mt-2 whitespace-pre-line rounded-xl bg-gray-50 p-3 text-sm leading-relaxed text-ink/70">
                  {p.bio}
                </p>
              )}
            </div>
          )}
        </div>
      </Card>

      {inCall && <VideoCall room={room} displayName={myName} onClose={endCall} />}

      {/* Tab bar */}
      <div className="flex flex-wrap gap-1 border-b border-gray-200" role="tablist">
        {TABS.map((tb) => {
          const active = tab === tb.key;
          const count = tabCount[tb.key];
          return (
            <button
              key={tb.key}
              role="tab"
              aria-selected={active}
              onClick={() => setTab(tb.key)}
              className={cn(
                "-mb-px flex items-center gap-1.5 border-b-2 px-3.5 py-2.5 text-sm font-medium transition focus:outline-none focus-visible:ring-2 focus-visible:ring-navy/30",
                active
                  ? "border-navy-900 text-navy-900"
                  : "border-transparent text-ink/55 hover:text-navy",
              )}
            >
              {t(`mentoring.${tb.labelKey}`)}
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
        <div className="space-y-4">
          {/* Next session with live state */}
          {nextSession ? (
            <Card
              className={cn(
                "flex flex-wrap items-center justify-between gap-4 p-5",
                sessState === "live"
                  ? "border-emerald-300 bg-emerald-50"
                  : "border-gold/30 bg-gold/[0.06]",
              )}
            >
              <div className="flex items-center gap-3">
                <div
                  className={cn(
                    "flex h-10 w-10 items-center justify-center rounded-xl",
                    sessState === "live"
                      ? "bg-emerald-500/15 text-emerald-600"
                      : "bg-gold/15 text-gold",
                  )}
                >
                  <CalendarClock className="h-5 w-5" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span
                      className={cn(
                        "text-[11px] font-semibold uppercase tracking-wide",
                        sessState === "live" ? "text-emerald-600" : "text-gold",
                      )}
                    >
                      {t("mentoring.nextSession")}
                    </span>
                    {sessState === "live" && (
                      <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/15 px-2 py-0.5 text-xs font-semibold text-emerald-600">
                        <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-500" />
                        {t("mentoring.liveNow")}
                      </span>
                    )}
                    {sessState === "soon" && (
                      <span className="rounded-full bg-gold/20 px-2 py-0.5 text-xs font-semibold text-gold">
                        {t("mentoring.startsIn", { n: minsToStart })}
                      </span>
                    )}
                  </div>
                  <div className="font-semibold text-navy-900">{nextSession.title}</div>
                  <div className="text-sm text-ink/55">{sessionWhen(nextSession.scheduledAt)}</div>
                </div>
              </div>
              <Button icon={Video} variant={sessState ? "primary" : "secondary"} onClick={startCall}>
                {t("mentoring.join")}
              </Button>
            </Card>
          ) : (
            <Card className="p-5 text-sm text-ink/55">
              {t("mentoring.noSessions")}
            </Card>
          )}

          {/* To-do shortcuts */}
          {(openTaskCount > 0 || quizzesToTake > 0) && (
            <div className="grid grid-cols-2 gap-3">
              <button
                onClick={() => setTab("tasks")}
                className="flex items-center gap-3 rounded-2xl border border-gray-200/70 bg-white p-4 text-left shadow-[var(--shadow-card)] transition hover:-translate-y-0.5 hover:shadow-[var(--shadow-pop)]"
              >
                <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-navy/10 text-navy">
                  <ClipboardCheck className="h-5 w-5" />
                </span>
                <span>
                  <span className="block text-xl font-bold leading-none text-navy-900">
                    {openTaskCount}
                  </span>
                  <span className="text-xs text-ink/55">
                    {openTaskCount === 1 ? t("mentoring.taskToDo") : t("mentoring.tasksToDo")}
                  </span>
                </span>
                <ChevronRight className="ml-auto h-4 w-4 text-ink/30" />
              </button>
              <button
                onClick={() => setTab("quizzes")}
                className="flex items-center gap-3 rounded-2xl border border-gray-200/70 bg-white p-4 text-left shadow-[var(--shadow-card)] transition hover:-translate-y-0.5 hover:shadow-[var(--shadow-pop)]"
              >
                <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-dim-skills/10 text-dim-skills">
                  <ListChecks className="h-5 w-5" />
                </span>
                <span>
                  <span className="block text-xl font-bold leading-none text-navy-900">
                    {quizzesToTake}
                  </span>
                  <span className="text-xs text-ink/55">
                    {quizzesToTake === 1 ? t("mentoring.quizToTake") : t("mentoring.quizzesToTake")}
                  </span>
                </span>
                <ChevronRight className="ml-auto h-4 w-4 text-ink/30" />
              </button>
            </div>
          )}

          {/* Feedback */}
          <Card className="p-6">
            <h2 className="mb-4 flex items-center gap-2 text-base font-semibold text-navy-900">
              <MessageSquareQuote className="h-4 w-4" /> {t("mentoring.feedbackTitle")}
            </h2>
            {feedback.data && feedback.data.length > 0 ? (
              <div className="space-y-2">
                {feedback.data.map((f, i) => (
                  <div
                    key={f.id}
                    className={cn(
                      "rounded-xl border p-3.5",
                      i === 0 && f.id === latestFeedback?.id
                        ? "border-gold/40 bg-gold/[0.06]"
                        : "border-gray-100",
                    )}
                  >
                    <p className="text-sm leading-relaxed text-ink">{f.body}</p>
                    <p className="mt-1.5 text-xs text-ink/40">
                      {f.mentorName ?? t("mentoring.mentorFallback")} ·{" "}
                      {new Date(f.createdAt).toLocaleDateString(dateLocale())}
                      {i === 0 && (
                        <span className="ml-2 rounded-full bg-gold/15 px-1.5 py-0.5 text-[10px] font-semibold text-gold">
                          {t("mentoring.latest")}
                        </span>
                      )}
                    </p>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-ink/50">{t("mentoring.noFeedback")}</p>
            )}
          </Card>
        </div>
      )}

      {/* ── Tasks ────────────────────────────────────────────────────── */}
      {tab === "tasks" && (
        <Card className="p-6">
          <div className="mb-4 flex items-center justify-between gap-3">
            <h2 className="flex items-center gap-2 text-base font-semibold text-navy-900">
              <ClipboardCheck className="h-4 w-4" /> {t("mentoring.yourTasks")}
            </h2>
            {totalTasks > 0 && (
              <div className="flex items-center gap-2">
                <ProgressBar
                  value={totalTasks ? (doneTasks / totalTasks) * 100 : 0}
                  className="w-24"
                  barClassName={doneTasks === totalTasks ? "bg-emerald-500" : undefined}
                />
                <span className="text-xs font-semibold text-ink/55">
                  {doneTasks}/{totalTasks}
                </span>
              </div>
            )}
          </div>
          {sortedTasks.length > 0 ? (
            <ul className="space-y-2">
              {sortedTasks.map((task) => (
                <li
                  key={task.id}
                  className={cn(
                    "flex items-start gap-3 rounded-xl border p-3 transition",
                    task.status === "done" ? "border-gray-100 opacity-70" : "border-gray-100",
                  )}
                >
                  <button
                    onClick={() =>
                      setTaskDone.mutate({ taskId: task.id, done: task.status !== "done" })
                    }
                    aria-label={
                      task.status === "done" ? t("mentoring.markNotDone") : t("mentoring.markDone")
                    }
                    className={cn(
                      "mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-md border transition",
                      task.status === "done"
                        ? "border-emerald-500 bg-emerald-500 text-white"
                        : "border-gray-300 text-transparent hover:border-navy/50",
                    )}
                  >
                    <Check className="h-4 w-4" />
                  </button>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span
                        className={
                          task.status === "done"
                            ? "font-medium text-ink/40 line-through"
                            : "font-medium text-navy-900"
                        }
                      >
                        {task.title}
                      </span>
                      {task.status !== "done" && dueLabel(task.dueAt) && (
                        <span
                          className={cn(
                            "rounded-full px-2 py-0.5 text-xs font-medium",
                            isOverdue(task.dueAt)
                              ? "bg-red-500/12 text-red-600"
                              : "bg-gold/15 text-gold",
                          )}
                        >
                          {isOverdue(task.dueAt)
                            ? t("dashboard.overdue")
                            : t("dashboard.due", { date: dueLabel(task.dueAt) ?? "" })}
                        </span>
                      )}
                    </div>
                    {task.instructions && (
                      <p className="mt-1 text-sm text-ink/60">{task.instructions}</p>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-ink/50">{t("mentoring.noTasks")}</p>
          )}
        </Card>
      )}

      {/* ── Quizzes ──────────────────────────────────────────────────── */}
      {tab === "quizzes" && (
        <Card className="p-6">
          <h2 className="mb-4 flex items-center gap-2 text-base font-semibold text-navy-900">
            <ListChecks className="h-4 w-4" /> {t("mentoring.quizzesTitle")}
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
                  className={cn(
                    "flex items-center gap-3 rounded-xl border p-3",
                    q.taken ? "border-gray-100" : "border-gold/40 bg-gold/[0.05]",
                  )}
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-navy-900">{q.title}</span>
                      {!q.taken && (
                        <span className="rounded-full bg-gold/20 px-2 py-0.5 text-[11px] font-semibold text-gold">
                          {t("mentoring.newBadge")}
                        </span>
                      )}
                    </div>
                    <span className="text-xs text-ink/50">
                      {q.questionCount === 1
                        ? t("mentoring.question", { n: q.questionCount })
                        : t("mentoring.questions", { n: q.questionCount })}
                    </span>
                  </div>
                  {q.taken && (
                    <span
                      className={cn(
                        "rounded-full px-2 py-0.5 text-xs font-semibold",
                        (q.score ?? 0) >= 70
                          ? "bg-emerald-500/12 text-emerald-600"
                          : "bg-amber-500/15 text-amber-600",
                      )}
                    >
                      {q.score}%
                    </span>
                  )}
                  <Button
                    variant={q.taken ? "secondary" : "primary"}
                    onClick={() => setTakingQuiz(q.id)}
                  >
                    {q.taken ? t("mentoring.retake") : t("mentoring.takeQuiz")}
                  </Button>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-ink/50">{t("mentoring.noQuizzes")}</p>
          )}
        </Card>
      )}

      {/* ── Messages ─────────────────────────────────────────────────── */}
      {tab === "messages" && (
        <MessageThread
          withUserId={mentor.id}
          title={t("mentoring.messagesWith", { name: mentor.name ?? t("mentoring.yourMentorFallback") })}
        />
      )}
    </div>
  );
}
