import {
  ArrowRight,
  ClipboardCheck,
  CalendarClock,
  ListMusic,
  Plus,
  Route as RouteIcon,
  Sparkles,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { Link } from "wouter";
import { trpc } from "../lib/trpc";
import { DimensionGauges } from "../components/DimensionGauges";
import { SessionList } from "../components/SessionList";
import { Button, Card, EmptyState, ProgressBar, Spinner } from "../components/ui";

const isToday = (d: string | Date) => new Date(d).toDateString() === new Date().toDateString();
const dueTime = (d: string | Date | null) => (d ? new Date(d).getTime() : Infinity);
const dueLabel = (d: string | Date | null) =>
  d ? new Date(d).toLocaleDateString(undefined, { month: "short", day: "numeric" }) : null;
const isOverdue = (d: string | Date | null) => !!d && new Date(d).getTime() < Date.now();

function Stat({ icon: Icon, value, label, to }: { icon: LucideIcon; value: number; label: string; to: string }) {
  return (
    <Link to={to}>
      <Card className="p-3 transition hover:-translate-y-0.5 hover:shadow-[var(--shadow-pop)] sm:p-4">
        <div className="flex items-center justify-between">
          <Icon className="h-5 w-5 text-navy/60" />
          <span className="text-2xl font-bold leading-none text-navy-900">{value}</span>
        </div>
        <div className="mt-2 text-[11px] leading-tight text-ink/55 sm:text-xs">{label}</div>
      </Card>
    </Link>
  );
}

export default function Dashboard() {
  const me = trpc.auth.me.useQuery();
  const progression = trpc.paths.progression.useQuery();
  const paths = trpc.paths.list.useQuery();
  const assigned = trpc.paths.assigned.useQuery();
  const sessions = trpc.sessions.mine.useQuery();
  const tasks = trpc.coaching.myTasks.useQuery();
  const playlists = trpc.playlists.mine.useQuery();
  const setupDemo = trpc.dev.setupMentorDemo.useMutation({
    onSuccess: () => window.location.assign("/mentor"),
  });

  const firstName = me.data?.name?.split(" ")[0] ?? "there";
  const isTeam = me.data?.activeOrganization?.type === "team";
  const isPersonal = !isTeam;

  const own = (paths.data ?? []).filter((p) => p.itemCount > 0);
  const learnerPaths = (isTeam ? (assigned.data ?? []) : own).map((p) => ({
    id: p.id,
    title: p.title,
    progress: p.progress,
    itemCount: p.itemCount,
    dueAt: (p as { dueAt?: string | Date | null }).dueAt ?? null,
  }));

  // Pick a path to resume: in-progress first (soonest due), else a not-started one.
  const inProgress = learnerPaths.filter((p) => p.progress > 0 && p.progress < 100);
  const notStarted = learnerPaths.filter((p) => p.progress === 0 && p.itemCount > 0);
  const continuePath =
    [...inProgress].sort(
      (a, b) => dueTime(a.dueAt) - dueTime(b.dueAt) || b.progress - a.progress,
    )[0] ?? notStarted[0];

  const contDetail = trpc.paths.get.useQuery(
    { id: continuePath?.id ?? 0 },
    { enabled: !!continuePath },
  );
  const nextStep = contDetail.data?.items.find((i) => !i.done)?.title;

  const upcoming = (sessions.data ?? []).filter(
    (s) => new Date(s.scheduledAt).getTime() > Date.now() - 30 * 60000,
  );
  const todaySessions = upcoming.filter((s) => isToday(s.scheduledAt));
  const openTasks = (tasks.data ?? []).filter((t) => t.status !== "done");
  const dueTasks = openTasks
    .filter((t) => t.dueAt && new Date(t.dueAt).getTime() < Date.now() + 24 * 3600 * 1000)
    .sort((a, b) => dueTime(a.dueAt) - dueTime(b.dueAt));

  if (me.isLoading) return <Spinner label="Loading…" />;

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-navy-900">Hi {firstName} 👋</h1>
        <p className="mt-1 text-ink/55">Here's your development at a glance.</p>
      </div>

      {/* Quick stats */}
      <div className="grid grid-cols-3 gap-3">
        <Stat icon={RouteIcon} value={inProgress.length} label="In progress" to="/paths" />
        <Stat icon={ClipboardCheck} value={openTasks.length} label="Tasks to do" to="/mentoring" />
        <Stat icon={CalendarClock} value={upcoming.length} label="Upcoming" to="/schedule" />
      </div>

      {/* Continue where you left off */}
      {continuePath && (
        <Card className="border-navy/15 bg-navy/[0.03] p-6">
          <div className="text-[11px] font-semibold uppercase tracking-wider text-navy/50">
            Continue where you left off
          </div>
          <div className="mt-1 flex flex-wrap items-end justify-between gap-3">
            <div className="min-w-0">
              <h3 className="text-lg font-bold text-navy-900">{continuePath.title}</h3>
              {nextStep && (
                <p className="mt-0.5 truncate text-sm text-ink/60">Next: {nextStep}</p>
              )}
            </div>
            <Link to={`/paths/${continuePath.id}`}>
              <Button icon={ArrowRight}>Continue</Button>
            </Link>
          </div>
          <ProgressBar value={continuePath.progress} className="mt-4" />
        </Card>
      )}

      {/* Today's agenda */}
      {(todaySessions.length > 0 || dueTasks.length > 0) && (
        <section>
          <h2 className="mb-3 text-xs font-semibold uppercase tracking-wider text-gold">Today</h2>
          <div className="space-y-3">
            {todaySessions.length > 0 && (
              <SessionList sessions={todaySessions} allowCancel={false} />
            )}
            {dueTasks.length > 0 && (
              <Card className="divide-y divide-gray-100">
                {dueTasks.map((t) => (
                  <Link key={t.id} to="/mentoring">
                    <div className="flex items-center gap-3 p-4 transition hover:bg-gray-50">
                      <ClipboardCheck className="h-4 w-4 shrink-0 text-navy/50" />
                      <span className="min-w-0 flex-1 truncate font-medium text-navy-900">
                        {t.title}
                      </span>
                      <span
                        className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-medium ${
                          isOverdue(t.dueAt)
                            ? "bg-red-500/12 text-red-600"
                            : "bg-gold/15 text-gold"
                        }`}
                      >
                        {isOverdue(t.dueAt) ? "Overdue" : `Due ${dueLabel(t.dueAt)}`}
                      </span>
                    </div>
                  </Link>
                ))}
              </Card>
            )}
          </div>
        </section>
      )}

      {/* Progress */}
      <section>
        <h2 className="mb-3 text-xs font-semibold uppercase tracking-wider text-gold">
          My progress
        </h2>
        {progression.data ? (
          <DimensionGauges data={progression.data} />
        ) : (
          <Spinner label="Loading…" />
        )}
      </section>

      {/* Paths */}
      <section>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-navy-900">
            {isTeam ? "Assigned to you" : "Your paths"}
          </h2>
          <Link
            to="/paths"
            className="inline-flex items-center gap-1 text-sm font-medium text-navy/70 transition hover:text-navy"
          >
            My Learning <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
        {learnerPaths.length > 0 ? (
          <div className="space-y-3">
            {learnerPaths.map((p) => (
              <Link key={p.id} to={`/paths/${p.id}`}>
                <Card className="p-5 transition hover:-translate-y-0.5 hover:shadow-[var(--shadow-pop)]">
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-navy-900">{p.title}</span>
                      {p.progress >= 100 ? (
                        <span className="rounded-full bg-emerald-500/12 px-2 py-0.5 text-xs font-medium text-emerald-600">
                          Completed
                        </span>
                      ) : (
                        dueLabel(p.dueAt) && (
                          <span
                            className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                              isOverdue(p.dueAt) ? "bg-red-500/12 text-red-600" : "bg-gold/15 text-gold"
                            }`}
                          >
                            {isOverdue(p.dueAt) ? "Overdue" : `Due ${dueLabel(p.dueAt)}`}
                          </span>
                        )
                      )}
                    </div>
                    <span className="text-sm font-medium text-ink/50">{p.progress}%</span>
                  </div>
                  <ProgressBar value={p.progress} className="mt-3" />
                </Card>
              </Link>
            ))}
          </div>
        ) : isTeam ? (
          <EmptyState
            icon={Plus}
            title="No paths assigned yet"
            description="Your mentor will assign learning paths for you here."
          />
        ) : (
          <EmptyState
            icon={Plus}
            title="No learning paths yet"
            description="Create a guided path and start growing your three dimensions."
            action={
              <Link to="/paths">
                <Button icon={Plus}>Create your first path</Button>
              </Link>
            }
          />
        )}
      </section>

      {/* Playlists */}
      <section>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-navy-900">Your playlists</h2>
          <Link
            to="/paths"
            className="inline-flex items-center gap-1 text-sm font-medium text-navy/70 transition hover:text-navy"
          >
            Manage <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
        {playlists.data && playlists.data.length > 0 ? (
          <div className="space-y-3">
            {playlists.data.slice(0, 3).map((pl) => (
              <Link key={pl.id} to={`/playlists/${pl.id}`}>
                <Card className="flex items-center gap-3 p-4 transition hover:-translate-y-0.5 hover:shadow-[var(--shadow-pop)]">
                  <ListMusic className="h-4 w-4 shrink-0 text-navy/50" />
                  <span className="min-w-0 flex-1 truncate font-medium text-navy-900">{pl.title}</span>
                  <span className="shrink-0 text-sm text-ink/50">
                    {pl.completedCount}/{pl.itemCount}
                  </span>
                </Card>
              </Link>
            ))}
          </div>
        ) : (
          <Card className="flex flex-wrap items-center justify-between gap-4 border-navy/15 bg-navy/[0.03] p-5">
            <div className="flex items-start gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-navy/10 text-navy">
                <ListMusic className="h-5 w-5" />
              </div>
              <div>
                <h3 className="font-semibold text-navy-900">Build your own playlist</h3>
                <p className="mt-0.5 max-w-md text-sm text-ink/55">
                  Collect courses from anywhere and learn at your own pace.
                </p>
              </div>
            </div>
            <Link to="/paths">
              <Button variant="secondary" icon={Plus}>
                Start a playlist
              </Button>
            </Link>
          </Card>
        )}
      </section>

      {isPersonal && !import.meta.env.PROD && (
        <Card className="flex flex-wrap items-center justify-between gap-4 border-navy/15 bg-navy/[0.03] p-5">
          <div className="flex items-start gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-navy/10 text-navy">
              <Sparkles className="h-5 w-5" />
            </div>
            <div>
              <h3 className="font-semibold text-navy-900">Mentor mode (demo)</h3>
              <p className="mt-0.5 max-w-md text-sm text-ink/55">
                Become a mentor in the Innovation Academy workspace with two assigned learners, to
                preview the mentor experience.
              </p>
            </div>
          </div>
          <Button
            variant="secondary"
            onClick={() => setupDemo.mutate()}
            disabled={setupDemo.isPending}
          >
            {setupDemo.isPending ? "Setting up…" : "Enable mentor demo"}
          </Button>
        </Card>
      )}
    </div>
  );
}
