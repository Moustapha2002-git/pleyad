import {
  ArrowRight,
  ChevronRight,
  ClipboardCheck,
  CalendarClock,
  GraduationCap,
  ListMusic,
  Play,
  Plus,
  Route as RouteIcon,
  Sparkles,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { Link } from "wouter";
import { trpc } from "../lib/trpc";
import { dateLocale, useT } from "../lib/i18n";
import { DimensionGauges } from "../components/DimensionGauges";
import { GettingStarted } from "../components/GettingStarted";
import { SessionList } from "../components/SessionList";
import { thumbnailFor } from "../lib/thumbnails";
import { Avatar, Button, Card, EmptyState, ProgressBar, Spinner, cn } from "../components/ui";

const isToday = (d: string | Date) => new Date(d).toDateString() === new Date().toDateString();
const dueTime = (d: string | Date | null) => (d ? new Date(d).getTime() : Infinity);
const dueLabel = (d: string | Date | null) =>
  d ? new Date(d).toLocaleDateString(dateLocale(), { month: "short", day: "numeric" }) : null;
const isOverdue = (d: string | Date | null) => !!d && new Date(d).getTime() < Date.now();

type Learnable = {
  id: number;
  title: string;
  progress: number;
  itemCount: number;
  completedCount: number;
  dueAt?: string | Date | null;
  nextSkill?: { resourceId: number; title: string } | null;
  previewSkills?: { title: string; url: string | null; thumbnailUrl: string | null }[];
};

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

/** Compact row with a real cover thumb — the Home-sized version of a path card. */
function LearnRow({
  p,
  detailTo,
  continueTo,
}: {
  p: Learnable;
  detailTo: string;
  continueTo: string | null;
}) {
  const { t } = useT();
  const first = p.previewSkills?.[0];
  const thumb = first ? thumbnailFor(first.url, first.thumbnailUrl) : null;
  const done = p.itemCount > 0 && p.progress >= 100;
  return (
    <Link to={continueTo ?? detailTo}>
      <Card className="flex items-center gap-3 p-3 transition hover:-translate-y-0.5 hover:shadow-[var(--shadow-pop)]">
        <span className="relative block h-14 w-24 shrink-0 overflow-hidden rounded-lg bg-gradient-to-br from-navy-800 to-navy-950">
          {thumb ? (
            <img src={thumb} alt="" loading="lazy" className="h-full w-full object-cover" />
          ) : (
            <span className="flex h-full w-full items-center justify-center px-1 text-center text-[8px] font-semibold uppercase tracking-wide text-white/50">
              {p.title.slice(0, 16)}
            </span>
          )}
          <span className="absolute inset-x-0 bottom-0 h-0.5 bg-black/40">
            <span
              className={cn("block h-full", done ? "bg-emerald-400" : "bg-gold")}
              style={{ width: `${p.progress}%` }}
            />
          </span>
        </span>
        <span className="min-w-0 flex-1">
          <span className="flex items-center gap-2">
            <span className="truncate font-semibold text-navy-900">{p.title}</span>
            {done ? (
              <span className="shrink-0 rounded-full bg-emerald-500/12 px-2 py-0.5 text-[11px] font-medium text-emerald-600">
                {t("dashboard.completed")}
              </span>
            ) : (
              dueLabel(p.dueAt ?? null) && (
                <span
                  className={cn(
                    "shrink-0 rounded-full px-2 py-0.5 text-[11px] font-medium",
                    isOverdue(p.dueAt ?? null)
                      ? "bg-red-500/12 text-red-600"
                      : "bg-gold/15 text-gold",
                  )}
                >
                  {isOverdue(p.dueAt ?? null)
                    ? t("dashboard.overdue")
                    : t("dashboard.due", { date: dueLabel(p.dueAt ?? null) ?? "" })}
                </span>
              )
            )}
          </span>
          <span className="mt-1 flex items-center gap-2">
            <ProgressBar
              value={p.progress}
              className="max-w-40 flex-1"
              barClassName={done ? "bg-emerald-500" : undefined}
            />
            <span className="text-xs font-semibold text-ink/55">{p.progress}%</span>
          </span>
          {p.nextSkill && !done && (
            <span className="mt-0.5 block truncate text-xs text-ink/45">
              {t("dashboard.next", { title: p.nextSkill.title })}
            </span>
          )}
        </span>
        <ChevronRight className="h-5 w-5 shrink-0 text-ink/30" />
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
  const mentors = trpc.mentor.myMentors.useQuery();
  const setupDemo = trpc.dev.setupMentorDemo.useMutation({
    onSuccess: () => window.location.assign("/mentor"),
  });

  const { t } = useT();
  const firstName = me.data?.name?.split(" ")[0] ?? "there";
  const isTeam = me.data?.activeOrganization?.type === "team";
  const isPersonal = !isTeam;
  const mentor = mentors.data?.[0];

  const own = (paths.data ?? []).filter((p) => p.itemCount > 0);
  const learnerPaths: Learnable[] = isTeam ? (assigned.data ?? []) : own;

  // In-progress first (soonest due), then not started, completed last.
  const rank = (p: Learnable) =>
    p.itemCount > 0 && p.progress >= 100 ? 2 : p.progress > 0 ? 0 : 1;
  const sortedPaths = [...learnerPaths].sort(
    (a, b) => rank(a) - rank(b) || dueTime(a.dueAt ?? null) - dueTime(b.dueAt ?? null),
  );
  const continuePath = sortedPaths.find((p) => rank(p) < 2 && p.itemCount > 0) ?? null;
  const heroThumb = continuePath?.previewSkills?.length
    ? thumbnailFor(
        continuePath.previewSkills[0]!.url,
        continuePath.previewSkills[0]!.thumbnailUrl,
      )
    : null;
  const continueTo = (p: Learnable, base: "/paths" | "/playlists") =>
    p.nextSkill ? `${base}/${p.id}/learn/${p.nextSkill.resourceId}` : null;

  const upcoming = (sessions.data ?? []).filter(
    (s) => new Date(s.scheduledAt).getTime() > Date.now() - 30 * 60000,
  );
  const todaySessions = upcoming.filter((s) => isToday(s.scheduledAt));
  const openTasks = (tasks.data ?? []).filter((t) => t.status !== "done");
  const dueTasks = openTasks
    .filter((t) => t.dueAt && new Date(t.dueAt).getTime() < Date.now() + 24 * 3600 * 1000)
    .sort((a, b) => dueTime(a.dueAt) - dueTime(b.dueAt));
  const inProgressCount = learnerPaths.filter((p) => p.progress > 0 && p.progress < 100).length;

  if (me.isLoading) return <Spinner label="Loading…" />;

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-navy-900">{t("dashboard.greeting", { name: firstName })}</h1>
        <p className="mt-1 text-ink/55">{t("dashboard.subtitle")}</p>
      </div>

      {/* First-visit onboarding (team learners; hides itself once complete) */}
      <GettingStarted />

      {/* Quick stats */}
      <div className="grid grid-cols-3 gap-3">
        <Stat icon={RouteIcon} value={inProgressCount} label={t("dashboard.inProgress")} to="/paths" />
        <Stat icon={ClipboardCheck} value={openTasks.length} label={t("dashboard.tasksToDo")} to="/mentoring" />
        <Stat icon={CalendarClock} value={upcoming.length} label={t("dashboard.upcoming")} to="/schedule" />
      </div>

      {/* Continue where you left off — one click into the workspace */}
      {continuePath && (
        <section aria-label="Continue learning">
          <div className="overflow-hidden rounded-2xl bg-navy-950 text-white shadow-[var(--shadow-pop)]">
            <div className="flex flex-col sm:flex-row">
              <div className="relative h-36 w-full shrink-0 sm:h-auto sm:w-64">
                {heroThumb ? (
                  <img src={heroThumb} alt="" className="h-full w-full object-cover" />
                ) : (
                  <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-navy-700 to-navy-950 px-3 text-center text-xs font-bold uppercase tracking-widest text-white/40">
                    {continuePath.title.slice(0, 24)}
                  </div>
                )}
                <span className="absolute inset-x-0 bottom-0 h-1 bg-black/40">
                  <span
                    className="block h-full bg-gold transition-[width] duration-700"
                    style={{ width: `${continuePath.progress}%` }}
                  />
                </span>
              </div>
              <div className="flex min-w-0 flex-1 flex-col justify-center gap-1.5 p-5">
                <div className="text-[11px] font-bold uppercase tracking-[0.2em] text-gold">
                  {continuePath.progress > 0 ? t("dashboard.continueTitle") : t("dashboard.startTitle")}
                </div>
                <h2 className="text-lg font-bold leading-tight">{continuePath.title}</h2>
                {continuePath.nextSkill && (
                  <p className="truncate text-sm text-white/60">
                    {t("dashboard.next", { title: continuePath.nextSkill.title })}
                  </p>
                )}
                <div className="mt-1.5 flex flex-wrap items-center gap-3">
                  <Link
                    to={continueTo(continuePath, "/paths") ?? `/paths/${continuePath.id}`}
                    className="inline-flex items-center gap-2 rounded-xl bg-gold px-4 py-2 text-sm font-bold text-navy-950 transition hover:brightness-105 focus:outline-none focus:ring-2 focus:ring-gold/60"
                  >
                    <Play className="h-4 w-4" fill="currentColor" />
                    {continuePath.progress > 0 ? t("dashboard.resume") : t("dashboard.startNow")}
                  </Link>
                  <span className="text-sm font-semibold text-white/70">
                    {continuePath.progress}%
                  </span>
                </div>
              </div>
            </div>
          </div>
        </section>
      )}

      {/* Today's agenda */}
      {(todaySessions.length > 0 || dueTasks.length > 0) && (
        <section>
          <h2 className="mb-3 text-xs font-semibold uppercase tracking-wider text-gold">{t("dashboard.today")}</h2>
          <div className="space-y-3">
            {todaySessions.length > 0 && (
              <SessionList sessions={todaySessions} allowCancel={false} />
            )}
            {dueTasks.length > 0 && (
              <Card className="divide-y divide-gray-100">
                {dueTasks.map((td) => (
                  <Link key={td.id} to="/mentoring">
                    <div className="flex items-center gap-3 p-4 transition hover:bg-gray-50">
                      <ClipboardCheck className="h-4 w-4 shrink-0 text-navy/50" />
                      <span className="min-w-0 flex-1 truncate font-medium text-navy-900">
                        {td.title}
                      </span>
                      <span
                        className={cn(
                          "shrink-0 rounded-full px-2 py-0.5 text-xs font-medium",
                          isOverdue(td.dueAt) ? "bg-red-500/12 text-red-600" : "bg-gold/15 text-gold",
                        )}
                      >
                        {isOverdue(td.dueAt) ? t("dashboard.overdue") : t("dashboard.due", { date: dueLabel(td.dueAt) ?? "" })}
                      </span>
                    </div>
                  </Link>
                ))}
              </Card>
            )}
          </div>
        </section>
      )}

      {/* Your mentor — always one tap away */}
      {isTeam && mentor && (
        <Link to="/mentoring">
          <Card className="flex items-center gap-3 p-4 transition hover:-translate-y-0.5 hover:shadow-[var(--shadow-pop)]">
            <Avatar name={mentor.name ?? mentor.email ?? "?"} className="h-11 w-11" />
            <span className="min-w-0 flex-1">
              <span className="block truncate font-semibold text-navy-900">
                {mentor.name ?? mentor.email}
              </span>
              <span className="block truncate text-xs text-ink/50">
                {mentor.profile?.headline ?? t("dashboard.yourMentor")}
              </span>
            </span>
            <span className="hidden items-center gap-1 text-sm font-medium text-navy/60 sm:inline-flex">
              <GraduationCap className="h-4 w-4" /> {t("nav.mentoring")}
            </span>
            <ChevronRight className="h-5 w-5 shrink-0 text-ink/30" />
          </Card>
        </Link>
      )}

      {/* Progress */}
      <section>
        <h2 className="mb-3 text-xs font-semibold uppercase tracking-wider text-gold">
          {t("dashboard.myProgress")}
        </h2>
        {progression.data ? (
          <DimensionGauges data={progression.data} />
        ) : (
          <Spinner label="Loading…" />
        )}
      </section>

      {/* Paths — top 3, in-progress first */}
      <section>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-navy-900">
            {isTeam ? t("dashboard.assignedToYou") : t("dashboard.yourPaths")}
          </h2>
          <Link
            to="/paths"
            className="inline-flex items-center gap-1 text-sm font-medium text-navy/70 transition hover:text-navy"
          >
            {t("dashboard.myLearningLink")} <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
        {sortedPaths.length > 0 ? (
          <div className="space-y-3">
            {sortedPaths.slice(0, 3).map((p) => (
              <LearnRow
                key={p.id}
                p={p}
                detailTo={`/paths/${p.id}`}
                continueTo={continueTo(p, "/paths")}
              />
            ))}
            {sortedPaths.length > 3 && (
              <Link
                to="/paths"
                className="block rounded-xl border border-dashed border-gray-200 p-3 text-center text-sm font-medium text-navy/60 transition hover:border-navy/40 hover:text-navy"
              >
                {t("dashboard.viewAllPaths", { count: sortedPaths.length })}
              </Link>
            )}
          </div>
        ) : isTeam ? (
          <EmptyState
            icon={Plus}
            title={t("dashboard.noPathsAssignedTitle")}
            description={t("dashboard.noPathsAssignedDesc")}
          />
        ) : (
          <EmptyState
            icon={Plus}
            title={t("dashboard.noPathsYetTitle")}
            description={t("dashboard.noPathsYetDesc")}
            action={
              <Link to="/paths">
                <Button icon={Plus}>{t("dashboard.createFirstPath")}</Button>
              </Link>
            }
          />
        )}
      </section>

      {/* Playlists */}
      <section>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-navy-900">{t("dashboard.yourPlaylists")}</h2>
          <Link
            to="/paths"
            className="inline-flex items-center gap-1 text-sm font-medium text-navy/70 transition hover:text-navy"
          >
            {t("dashboard.manage")} <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
        {playlists.data && playlists.data.length > 0 ? (
          <div className="space-y-3">
            {playlists.data.slice(0, 3).map((pl) => (
              <LearnRow
                key={pl.id}
                p={pl}
                detailTo={`/playlists/${pl.id}`}
                continueTo={continueTo(pl, "/playlists")}
              />
            ))}
          </div>
        ) : (
          <Card className="flex flex-wrap items-center justify-between gap-4 border-navy/15 bg-navy/[0.03] p-5">
            <div className="flex items-start gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-navy/10 text-navy">
                <ListMusic className="h-5 w-5" />
              </div>
              <div>
                <h3 className="font-semibold text-navy-900">{t("dashboard.buildPlaylistTitle")}</h3>
                <p className="mt-0.5 max-w-md text-sm text-ink/55">
                  {t("dashboard.buildPlaylistDesc")}
                </p>
              </div>
            </div>
            <Link to="/paths">
              <Button variant="secondary" icon={Plus}>
                {t("dashboard.startPlaylist")}
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
