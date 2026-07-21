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
import { dateLocale, useT } from "../lib/i18n";
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
  { key: "overview", labelKey: "tabOverview" },
  { key: "learners", labelKey: "tabLearners" },
  { key: "paths", labelKey: "tabPaths" },
  { key: "sessions", labelKey: "tabSessions" },
] as const;
type Tab = (typeof TABS)[number]["key"];

const fmtDate = (d: string | Date | null) =>
  d
    ? new Date(d).toLocaleDateString(dateLocale(), { month: "short", day: "numeric", year: "numeric" })
    : "—";
const fmtWhen = (d: string | Date) =>
  new Date(d).toLocaleString(dateLocale(), {
    weekday: "short",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });

export default function AdminMentorDetail({ mentorId }: { mentorId: number }) {
  const { t } = useT();
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
      toast.success(t("adminMentorDetail.learnerAssigned"));
    },
    onError: (e) => toast.error(e.message),
  });
  const unassignMentor = trpc.admin.unassignMentor.useMutation({
    onSuccess: () => {
      refresh();
      toast.info(t("adminMentorDetail.learnerRemoved"));
    },
    onError: (e) => toast.error(e.message),
  });

  if (dir.isLoading) return <Spinner label={t("adminMentorDetail.loading")} />;
  if (!mentor) return <p className="text-ink/50">{t("adminMentorDetail.notFound")}</p>;

  const name = mentor.name ?? mentor.email;
  const unmentored = (members.data ?? []).filter((m) => m.role === "member" && !m.mentorUserId);
  const authored = (paths.data?.rows ?? []).filter((p) => p.creatorId === mentorId);

  return (
    <div className="space-y-6">
      <Link
        to="/mentors"
        className="inline-flex items-center gap-1 text-sm text-navy/60 transition hover:text-navy"
      >
        <ArrowLeft className="h-4 w-4" /> {t("adminMentorDetail.back")}
      </Link>

      <div className="flex flex-wrap items-center gap-4">
        <Avatar name={name} className="h-14 w-14 text-base" />
        <div className="min-w-0 flex-1">
          <h1 className="text-2xl font-bold tracking-tight text-navy-900">{name}</h1>
          <p className="text-ink/50">{mentor.profile.headline ?? mentor.email}</p>
        </div>
        <Badge className="bg-gold/15 text-gold">
          {t(`roles.${mentor.role}`)}
        </Badge>
      </div>

      {/* Tab bar */}
      <div className="flex flex-wrap gap-1 border-b border-gray-200">
        {TABS.map((tb) => (
          <button
            key={tb.key}
            onClick={() => setTab(tb.key)}
            className={cn(
              "-mb-px border-b-2 px-3.5 py-2.5 text-sm font-medium transition",
              tab === tb.key
                ? "border-navy-900 text-navy-900"
                : "border-transparent text-ink/55 hover:text-navy",
            )}
          >
            {t(`adminMentorDetail.${tb.labelKey}`)}
            {tb.key === "learners" && ` (${mentor.learnerCount})`}
            {tb.key === "paths" && ` (${authored.length})`}
            {tb.key === "sessions" && ` (${mentor.upcomingSessions})`}
          </button>
        ))}
      </div>

      {/* ── Overview ─────────────────────────────────────────────────── */}
      {tab === "overview" && (
        <div className="space-y-6">
          {/* About (self-edited by the mentor in Settings) */}
          {(mentor.profile.bio ||
            mentor.profile.expertise.length > 0 ||
            mentor.profile.languages.length > 0 ||
            mentor.profile.availabilityNote) && (
            <Card className="space-y-4 p-6">
              {mentor.profile.bio && (
                <div>
                  <h2 className="mb-1 text-sm font-semibold text-navy-900">{t("adminMentorDetail.about")}</h2>
                  <p className="whitespace-pre-line text-sm leading-relaxed text-ink/70">
                    {mentor.profile.bio}
                  </p>
                </div>
              )}
              <div className="flex flex-wrap gap-x-8 gap-y-3">
                {mentor.profile.expertise.length > 0 && (
                  <div>
                    <div className="mb-1.5 text-[11px] font-semibold uppercase tracking-wide text-ink/40">
                      {t("adminMentorDetail.expertise")}
                    </div>
                    <div className="flex flex-wrap gap-1.5">
                      {mentor.profile.expertise.map((tag) => (
                        <span
                          key={tag}
                          className="rounded-full bg-navy/5 px-2.5 py-0.5 text-xs font-medium text-navy/70"
                        >
                          {tag}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
                {mentor.profile.languages.length > 0 && (
                  <div>
                    <div className="mb-1.5 text-[11px] font-semibold uppercase tracking-wide text-ink/40">
                      {t("adminMentorDetail.languages")}
                    </div>
                    <div className="text-sm text-ink/70">
                      {mentor.profile.languages.join(" · ")}
                    </div>
                  </div>
                )}
                {mentor.profile.availabilityNote && (
                  <div>
                    <div className="mb-1.5 text-[11px] font-semibold uppercase tracking-wide text-ink/40">
                      {t("adminMentorDetail.availability")}
                    </div>
                    <div className="text-sm text-ink/70">{mentor.profile.availabilityNote}</div>
                  </div>
                )}
                <div>
                  <div className="mb-1.5 text-[11px] font-semibold uppercase tracking-wide text-ink/40">
                    {t("adminMentorDetail.contact")}
                  </div>
                  <a
                    href={`mailto:${mentor.email}`}
                    className="text-sm font-medium text-navy underline-offset-2 hover:underline"
                  >
                    {mentor.email}
                  </a>
                </div>
              </div>
            </Card>
          )}

          <Card className="grid grid-cols-2 gap-4 p-5 sm:grid-cols-4">
            {[
              { label: t("adminMentorDetail.joinedWorkspace"), value: fmtDate(mentor.joinedAt) },
              { label: t("adminMentorDetail.lastSignIn"), value: fmtDate(mentor.lastSignedInAt) },
              { label: t("adminMentorDetail.pathsAuthored"), value: String(mentor.pathsAuthored) },
              {
                label: t("adminMentorDetail.upcomingSessions"),
                value: String(mentor.upcomingSessions),
              },
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
              {t("adminMentorDetail.cohortPerformance")}
            </h2>
            <div className="grid gap-4 sm:grid-cols-3">
              <Card className="p-5">
                <div className="text-3xl font-bold text-navy-900">{mentor.avgProgress}%</div>
                <div className="mt-1 text-sm text-ink/55">{t("adminMentorDetail.avgLearnerProgress")}</div>
                <ProgressBar value={mentor.avgProgress} className="mt-3" />
              </Card>
              <Card className="p-5">
                <div className="text-3xl font-bold text-navy-900">
                  {mentor.completedLearners}
                  <span className="text-lg text-ink/40">/{mentor.learnerCount}</span>
                </div>
                <div className="mt-1 text-sm text-ink/55">{t("adminMentorDetail.learnersCompleted")}</div>
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
                <div className="mt-1 text-sm text-ink/55">{t("adminMentorDetail.learnersNeedAttention")}</div>
                <ProgressBar
                  value={
                    mentor.learnerCount ? (mentor.atRiskCount / mentor.learnerCount) * 100 : 0
                  }
                  className="mt-3"
                  barClassName="bg-red-400"
                />
              </Card>
            </div>
            <p className="mt-2 text-xs text-ink/40">{t("adminMentorDetail.derivedNote")}</p>
          </section>
        </div>
      )}

      {/* ── Learners ─────────────────────────────────────────────────── */}
      {tab === "learners" && (
        <div className="space-y-4">
          {/* Assign a learner */}
          <Card className="p-5">
            <h2 className="mb-3 flex items-center gap-2 text-sm font-semibold text-navy-900">
              <UserPlus className="h-4 w-4" /> {t("adminMentorDetail.assignLearner")}
            </h2>
            <div className="flex flex-col gap-2 sm:flex-row">
              <Select
                value={assignId}
                onChange={(e) => setAssignId(e.target.value)}
                className="sm:flex-1"
              >
                <option value="">
                  {unmentored.length > 0
                    ? t("adminMentorDetail.chooseUnmentored")
                    : t("adminMentorDetail.allHaveMentor")}
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
                {t("adminMentorDetail.assign")}
              </Button>
            </div>
          </Card>

          {mentees.isLoading ? (
            <ListSkeleton rows={3} />
          ) : (mentees.data?.rows.length ?? 0) === 0 ? (
            <EmptyState
              icon={UserPlus}
              title={t("adminMentorDetail.noLearnersTitle")}
              description={t("adminMentorDetail.noLearnersDesc")}
            />
          ) : (
            <Card className="divide-y divide-gray-100">
              {mentees.data!.rows.map((l) => (
                <div key={l.userId} className="flex items-center gap-3 p-4">
                  <Avatar name={l.name ?? l.email} />
                  <div className="min-w-0 flex-1">
                    <div className="truncate font-medium text-navy-900">{l.name ?? l.email}</div>
                    <div className="text-xs text-ink/50">
                      {l.assignedCount === 1
                        ? t("adminMentorDetail.pathCountOne", { n: l.assignedCount })
                        : t("adminMentorDetail.pathCount", { n: l.assignedCount })}{" "}
                      · {l.avgProgress}%
                    </div>
                  </div>
                  <div className="hidden w-28 sm:block">
                    <ProgressBar value={l.avgProgress} />
                  </div>
                  <Link
                    to={`/mentor/${l.userId}`}
                    className="inline-flex items-center gap-0.5 rounded-lg border border-gray-200 px-2.5 py-1.5 text-xs font-medium text-navy/70 transition hover:bg-gray-50"
                  >
                    {t("adminMentorDetail.profile")} <ChevronRight className="h-3.5 w-3.5" />
                  </Link>
                  <button
                    onClick={() =>
                      unassignMentor.mutate({ learnerUserId: l.userId, mentorUserId: mentorId })
                    }
                    className="rounded-lg border border-gray-200 p-1.5 text-ink/50 transition hover:bg-red-50 hover:text-red-600"
                    aria-label={t("adminMentorDetail.removeAria")}
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
            title={t("adminMentorDetail.noPathsTitle")}
            description={t("adminMentorDetail.noPathsDesc")}
          />
        ) : (
          <div className="space-y-3">
            {authored.map((p) => (
              <Link key={p.id} to={`/paths/${p.id}`}>
                <Card className="flex items-center gap-4 p-4 transition hover:-translate-y-0.5 hover:shadow-[var(--shadow-pop)]">
                  <div className="min-w-0 flex-1">
                    <div className="font-semibold text-navy-900">{p.title}</div>
                    <div className="text-xs text-ink/50">
                      {p.skillCount === 1
                        ? t("adminMentorDetail.skillCountOne", { n: p.skillCount })
                        : t("adminMentorDetail.skillCount", { n: p.skillCount })}{" "}
                      · {t("adminMentorDetail.enrolled", { n: p.enrolledCount })}
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
            title={t("adminMentorDetail.noSessionsTitle")}
            description={t("adminMentorDetail.noSessionsDesc")}
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
                    {t("adminMentorDetail.sessionWith", {
                      name: s.learnerName ?? s.learnerEmail ?? "",
                    })}{" "}
                    · {fmtWhen(s.scheduledAt)} ·{" "}
                    {t("adminMentorDetail.duration", { n: s.durationMinutes })}
                  </div>
                </div>
              </div>
            ))}
          </Card>
        ))}
    </div>
  );
}
