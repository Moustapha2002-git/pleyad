import { useState } from "react";
import {
  ArrowLeft,
  CalendarClock,
  ChevronRight,
  Route as RouteIcon,
  UserMinus,
  UserPlus,
} from "lucide-react";
import { Link } from "wouter";
import { trpc } from "../lib/trpc";
import { useToast } from "../components/Toast";
import {
  Avatar,
  Badge,
  Button,
  Card,
  EmptyState,
  ListSkeleton,
  PageHeader,
  ProgressBar,
  Select,
  Spinner,
  cn,
} from "../components/ui";

const TABS = [
  { key: "overview", label: "Overview" },
  { key: "learners", label: "Learners" },
  { key: "paths", label: "Paths" },
  { key: "sessions", label: "Sessions" },
] as const;
type Tab = (typeof TABS)[number]["key"];

const fmtDate = (d: string | Date | null) =>
  d
    ? new Date(d).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" })
    : "—";
const fmtWhen = (d: string | Date) =>
  new Date(d).toLocaleString(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });

export default function AdminMentorDetail({ mentorId }: { mentorId: number }) {
  const toast = useToast();
  const utils = trpc.useUtils();
  const [tab, setTab] = useState<Tab>("overview");
  const [assignId, setAssignId] = useState("");

  const dir = trpc.admin.mentorsDirectory.useQuery({});
  const mentor = dir.data?.rows.find((m) => m.userId === mentorId);

  const mentees = trpc.admin.learners.useQuery({ mentorUserId: mentorId, pageSize: 48 });
  const members = trpc.admin.members.useQuery();
  const paths = trpc.admin.pathsDirectory.useQuery({});
  const sessions = trpc.admin.mentorSessions.useQuery({ mentorUserId: mentorId });

  const refresh = () => {
    utils.admin.learners.invalidate();
    utils.admin.mentorsDirectory.invalidate();
    utils.admin.members.invalidate();
  };
  const assignMentor = trpc.admin.assignMentor.useMutation({
    onSuccess: () => {
      setAssignId("");
      refresh();
      toast.success("Learner assigned to this mentor");
    },
    onError: (e) => toast.error(e.message),
  });
  const unassignMentor = trpc.admin.unassignMentor.useMutation({
    onSuccess: () => {
      refresh();
      toast.info("Learner removed from this mentor");
    },
    onError: (e) => toast.error(e.message),
  });

  if (dir.isLoading) return <Spinner label="Loading mentor…" />;
  if (!mentor) return <p className="text-ink/50">Mentor not found.</p>;

  const name = mentor.name ?? mentor.email;
  const unmentored = (members.data ?? []).filter((m) => m.role === "member" && !m.mentorUserId);
  const authored = (paths.data?.rows ?? []).filter((p) => p.creatorId === mentorId);

  return (
    <div className="space-y-6">
      <Link
        to="/mentors"
        className="inline-flex items-center gap-1 text-sm text-navy/60 transition hover:text-navy"
      >
        <ArrowLeft className="h-4 w-4" /> Mentors
      </Link>

      <div className="flex flex-wrap items-center gap-4">
        <Avatar name={name} className="h-14 w-14 text-base" />
        <div className="min-w-0 flex-1">
          <h1 className="text-2xl font-bold tracking-tight text-navy-900">{name}</h1>
          <p className="text-ink/50">{mentor.email}</p>
        </div>
        <Badge className="bg-gold/15 text-gold">
          {mentor.role === "mentor" ? "Mentor" : mentor.role}
        </Badge>
      </div>

      {/* Tab bar */}
      <div className="flex flex-wrap gap-1 border-b border-gray-200">
        {TABS.map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={cn(
              "-mb-px border-b-2 px-3.5 py-2.5 text-sm font-medium transition",
              tab === t.key
                ? "border-navy-900 text-navy-900"
                : "border-transparent text-ink/55 hover:text-navy",
            )}
          >
            {t.label}
            {t.key === "learners" && ` (${mentor.learnerCount})`}
            {t.key === "paths" && ` (${authored.length})`}
            {t.key === "sessions" && ` (${mentor.upcomingSessions})`}
          </button>
        ))}
      </div>

      {/* ── Overview ─────────────────────────────────────────────────── */}
      {tab === "overview" && (
        <div className="space-y-6">
          <Card className="grid grid-cols-2 gap-4 p-5 sm:grid-cols-4">
            {[
              { label: "Joined workspace", value: fmtDate(mentor.joinedAt) },
              { label: "Last sign-in", value: fmtDate(mentor.lastSignedInAt) },
              { label: "Paths authored", value: String(mentor.pathsAuthored) },
              { label: "Upcoming sessions", value: String(mentor.upcomingSessions) },
            ].map((f) => (
              <div key={f.label}>
                <div className="text-[11px] font-semibold uppercase tracking-wide text-ink/40">
                  {f.label}
                </div>
                <div className="mt-0.5 text-sm font-semibold text-navy-900">{f.value}</div>
              </div>
            ))}
          </Card>

          {/* Performance — real numbers, derived from the cohort */}
          <section>
            <h2 className="mb-3 text-xs font-semibold uppercase tracking-wider text-gold">
              Cohort performance
            </h2>
            <div className="grid gap-4 sm:grid-cols-3">
              <Card className="p-5">
                <div className="text-3xl font-bold text-navy-900">{mentor.avgProgress}%</div>
                <div className="mt-1 text-sm text-ink/55">Average learner progress</div>
                <ProgressBar value={mentor.avgProgress} className="mt-3" />
              </Card>
              <Card className="p-5">
                <div className="text-3xl font-bold text-navy-900">
                  {mentor.completedLearners}
                  <span className="text-lg text-ink/40">/{mentor.learnerCount}</span>
                </div>
                <div className="mt-1 text-sm text-ink/55">Learners completed all paths</div>
                <ProgressBar
                  value={
                    mentor.learnerCount
                      ? (mentor.completedLearners / mentor.learnerCount) * 100
                      : 0
                  }
                  className="mt-3"
                  barClassName="bg-emerald-500"
                />
              </Card>
              <Card className="p-5">
                <div
                  className={cn(
                    "text-3xl font-bold",
                    mentor.atRiskCount > 0 ? "text-red-600" : "text-navy-900",
                  )}
                >
                  {mentor.atRiskCount}
                </div>
                <div className="mt-1 text-sm text-ink/55">Learners needing attention</div>
                <ProgressBar
                  value={
                    mentor.learnerCount ? (mentor.atRiskCount / mentor.learnerCount) * 100 : 0
                  }
                  className="mt-3"
                  barClassName="bg-red-400"
                />
              </Card>
            </div>
            <p className="mt-2 text-xs text-ink/40">
              Derived live from learner activity — mentor bios, expertise and ratings arrive with
              mentor profiles.
            </p>
          </section>
        </div>
      )}

      {/* ── Learners ─────────────────────────────────────────────────── */}
      {tab === "learners" && (
        <div className="space-y-4">
          {/* Assign a learner */}
          <Card className="p-5">
            <h2 className="mb-3 flex items-center gap-2 text-sm font-semibold text-navy-900">
              <UserPlus className="h-4 w-4" /> Assign a learner
            </h2>
            <div className="flex flex-col gap-2 sm:flex-row">
              <Select
                value={assignId}
                onChange={(e) => setAssignId(e.target.value)}
                className="sm:flex-1"
              >
                <option value="">
                  {unmentored.length > 0
                    ? "Choose an unmentored learner…"
                    : "Every learner already has a mentor"}
                </option>
                {unmentored.map((l) => (
                  <option key={l.userId} value={l.userId}>
                    {l.name ?? l.email}
                  </option>
                ))}
              </Select>
              <Button
                icon={UserPlus}
                disabled={!assignId || assignMentor.isPending}
                onClick={() =>
                  assignMentor.mutate({ learnerUserId: Number(assignId), mentorUserId: mentorId })
                }
              >
                Assign
              </Button>
            </div>
          </Card>

          {mentees.isLoading ? (
            <ListSkeleton rows={3} />
          ) : (mentees.data?.rows.length ?? 0) === 0 ? (
            <EmptyState
              icon={UserPlus}
              title="No learners yet"
              description="Assign learners to this mentor with the selector above."
            />
          ) : (
            <Card className="divide-y divide-gray-100">
              {mentees.data!.rows.map((l) => (
                <div key={l.userId} className="flex items-center gap-3 p-4">
                  <Avatar name={l.name ?? l.email} />
                  <div className="min-w-0 flex-1">
                    <div className="truncate font-medium text-navy-900">{l.name ?? l.email}</div>
                    <div className="text-xs text-ink/50">
                      {l.assignedCount} path{l.assignedCount === 1 ? "" : "s"} · {l.avgProgress}%
                    </div>
                  </div>
                  <div className="hidden w-28 sm:block">
                    <ProgressBar value={l.avgProgress} />
                  </div>
                  <Link
                    to={`/mentor/${l.userId}`}
                    className="inline-flex items-center gap-0.5 rounded-lg border border-gray-200 px-2.5 py-1.5 text-xs font-medium text-navy/70 transition hover:bg-gray-50"
                  >
                    Profile <ChevronRight className="h-3.5 w-3.5" />
                  </Link>
                  <button
                    onClick={() =>
                      unassignMentor.mutate({ learnerUserId: l.userId, mentorUserId: mentorId })
                    }
                    className="rounded-lg border border-gray-200 p-1.5 text-ink/50 transition hover:bg-red-50 hover:text-red-600"
                    aria-label="Remove from this mentor"
                  >
                    <UserMinus className="h-3.5 w-3.5" />
                  </button>
                </div>
              ))}
            </Card>
          )}
        </div>
      )}

      {/* ── Paths ────────────────────────────────────────────────────── */}
      {tab === "paths" &&
        (authored.length === 0 ? (
          <EmptyState
            icon={RouteIcon}
            title="No paths authored"
            description="Paths this mentor creates will appear here."
          />
        ) : (
          <div className="space-y-3">
            {authored.map((p) => (
              <Link key={p.id} to={`/paths/${p.id}`}>
                <Card className="flex items-center gap-4 p-4 transition hover:-translate-y-0.5 hover:shadow-[var(--shadow-pop)]">
                  <div className="min-w-0 flex-1">
                    <div className="font-semibold text-navy-900">{p.title}</div>
                    <div className="text-xs text-ink/50">
                      {p.skillCount} skill{p.skillCount === 1 ? "" : "s"} · {p.enrolledCount}{" "}
                      enrolled
                    </div>
                  </div>
                  <div className="hidden w-28 sm:block">
                    <ProgressBar value={p.avgProgress} />
                  </div>
                  <span className="text-sm font-semibold text-navy-900">{p.avgProgress}%</span>
                  <ChevronRight className="h-5 w-5 text-ink/30" />
                </Card>
              </Link>
            ))}
          </div>
        ))}

      {/* ── Sessions ─────────────────────────────────────────────────── */}
      {tab === "sessions" &&
        (sessions.isLoading ? (
          <ListSkeleton rows={2} />
        ) : (sessions.data?.length ?? 0) === 0 ? (
          <EmptyState
            icon={CalendarClock}
            title="No upcoming sessions"
            description="This mentor's scheduled sessions will appear here."
          />
        ) : (
          <Card className="divide-y divide-gray-100">
            {sessions.data!.map((s) => (
              <div key={s.id} className="flex items-center gap-3 p-4">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gold/15 text-gold">
                  <CalendarClock className="h-5 w-5" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="font-medium text-navy-900">{s.title}</div>
                  <div className="text-xs text-ink/50">
                    with {s.learnerName ?? s.learnerEmail} · {fmtWhen(s.scheduledAt)} ·{" "}
                    {s.durationMinutes}m
                  </div>
                </div>
              </div>
            ))}
          </Card>
        ))}
    </div>
  );
}
