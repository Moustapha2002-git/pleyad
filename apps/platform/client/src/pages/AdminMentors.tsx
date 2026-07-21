import { useState } from "react";
import {
  AlertTriangle,
  CalendarClock,
  ChevronRight,
  GraduationCap,
  Route as RouteIcon,
  Search,
  UserCheck,
  Users,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { Link } from "wouter";
import { trpc } from "../lib/trpc";
import { dateLocale, useT } from "../lib/i18n";
import {
  Avatar,
  Badge,
  Card,
  EmptyState,
  ListSkeleton,
  PageHeader,
  ProgressBar,
  Select,
  TextInput,
  cn,
} from "../components/ui";

type Sort = "name" | "learners" | "progress" | "sessions";

type T = (key: string, vars?: Record<string, string | number>) => string;

const lastSeen = (d: string | Date | null, t: T) => {
  if (!d) return t("adminMentors.neverSignedIn");
  const days = Math.floor((Date.now() - new Date(d).getTime()) / 86_400_000);
  if (days <= 0) return t("adminMentors.seenToday");
  if (days === 1) return t("adminMentors.seenYesterday");
  return t("adminMentors.seenDaysAgo", { n: days });
};
const fmtSession = (d: string | Date | null) =>
  d
    ? new Date(d).toLocaleString(dateLocale(), {
        month: "short",
        day: "numeric",
        hour: "numeric",
        minute: "2-digit",
      })
    : null;

function Stat({ icon: Icon, value, label, tone = "bg-navy/10 text-navy" }: {
  icon: LucideIcon; value: string | number; label: string; tone?: string;
}) {
  return (
    <Card className="p-3 sm:p-4">
      <div className="flex items-center justify-between">
        <span className={cn("flex h-8 w-8 items-center justify-center rounded-lg", tone)}>
          <Icon className="h-4 w-4" />
        </span>
        <span className="text-2xl font-bold leading-none text-navy-900">{value}</span>
      </div>
      <div className="mt-2 text-[11px] leading-tight text-ink/55 sm:text-xs">{label}</div>
    </Card>
  );
}

export default function AdminMentors() {
  const { t } = useT();
  const [search, setSearch] = useState("");
  const [sort, setSort] = useState<Sort>("name");
  const dir = trpc.admin.mentorsDirectory.useQuery({ search: search || undefined, sort });
  const data = dir.data;

  return (
    <div className="space-y-6">
      <PageHeader title={t("adminMentors.title")} subtitle={t("adminMentors.subtitle")} />

      {/* Stats */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat icon={Users} value={data?.stats.mentors ?? "…"} label={t("adminMentors.statMentors")} />
        <Stat
          icon={UserCheck}
          value={data?.stats.mentoredLearners ?? "…"}
          label={t("adminMentors.statCovered")}
          tone="bg-emerald-500/12 text-emerald-600"
        />
        <Stat
          icon={GraduationCap}
          value={data?.stats.avgLearnersPerMentor ?? "…"}
          label={t("adminMentors.statAvgPerMentor")}
          tone="bg-dim-knowledge/10 text-dim-knowledge"
        />
        <Stat
          icon={AlertTriangle}
          value={data?.stats.unmentoredLearners ?? "…"}
          label={t("adminMentors.statUnmentored")}
          tone={
            (data?.stats.unmentoredLearners ?? 0) > 0
              ? "bg-red-500/12 text-red-600"
              : "bg-emerald-500/12 text-emerald-600"
          }
        />
      </div>

      {/* Controls */}
      <div className="flex flex-col gap-2 sm:flex-row">
        <div className="relative sm:flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink/35" />
          <TextInput
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={t("adminMentors.searchPlaceholder")}
            className="pl-9"
          />
        </div>
        <Select value={sort} onChange={(e) => setSort(e.target.value as Sort)}>
          <option value="name">{t("adminMentors.sortName")}</option>
          <option value="learners">{t("adminMentors.sortLearners")}</option>
          <option value="progress">{t("adminMentors.sortProgress")}</option>
          <option value="sessions">{t("adminMentors.sortSessions")}</option>
        </Select>
      </div>

      {/* Cards */}
      {dir.isLoading ? (
        <ListSkeleton rows={4} />
      ) : (data?.rows.length ?? 0) === 0 ? (
        <EmptyState
          icon={Users}
          title={t("adminMentors.emptyTitle")}
          description={t("adminMentors.emptyDesc")}
        />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {data!.rows.map((m) => (
            <Link key={m.userId} to={`/mentors/${m.userId}`}>
              <Card className="flex h-full flex-col p-5 transition hover:-translate-y-0.5 hover:shadow-[var(--shadow-pop)]">
                <div className="flex items-start gap-3">
                  <Avatar name={m.name ?? m.email} className="h-12 w-12 text-sm" />
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-1.5">
                      <span className="truncate font-semibold text-navy-900">
                        {m.name ?? m.email}
                      </span>
                      <Badge>{t(`roles.${m.role}`)}</Badge>
                    </div>
                    <div className="truncate text-xs text-ink/50">
                      {m.profile.headline ?? m.email}
                    </div>
                  </div>
                  <ChevronRight className="h-5 w-5 shrink-0 text-ink/30" />
                </div>

                {m.profile.expertise.length > 0 && (
                  <div className="mt-3 flex flex-wrap gap-1.5">
                    {m.profile.expertise.slice(0, 3).map((tag) => (
                      <span
                        key={tag}
                        className="rounded-full bg-navy/5 px-2 py-0.5 text-[11px] font-medium text-navy/70"
                      >
                        {tag}
                      </span>
                    ))}
                    {m.profile.expertise.length > 3 && (
                      <span className="text-[11px] text-ink/40">
                        +{m.profile.expertise.length - 3}
                      </span>
                    )}
                  </div>
                )}

                <div className="mt-4 grid grid-cols-3 gap-2 text-center">
                  <div className="rounded-xl bg-gray-50 py-2">
                    <div className="text-lg font-bold text-navy-900">{m.learnerCount}</div>
                    <div className="text-[10px] text-ink/50">{t("adminMentors.learners")}</div>
                  </div>
                  <div className="rounded-xl bg-gray-50 py-2">
                    <div className="text-lg font-bold text-navy-900">{m.pathsAuthored}</div>
                    <div className="text-[10px] text-ink/50">{t("adminMentors.paths")}</div>
                  </div>
                  <div
                    className={cn(
                      "rounded-xl py-2",
                      m.atRiskCount > 0 ? "bg-red-500/10" : "bg-gray-50",
                    )}
                  >
                    <div
                      className={cn(
                        "text-lg font-bold",
                        m.atRiskCount > 0 ? "text-red-600" : "text-navy-900",
                      )}
                    >
                      {m.atRiskCount}
                    </div>
                    <div className="text-[10px] text-ink/50">{t("adminMentors.atRisk")}</div>
                  </div>
                </div>

                <div className="mt-3 flex items-center gap-2">
                  <ProgressBar value={m.avgProgress} className="flex-1" />
                  <span className="text-sm font-semibold text-navy-900">{m.avgProgress}%</span>
                </div>
                <div className="mt-1 text-[11px] text-ink/45">{t("adminMentors.cohortProgress")}</div>

                <div className="mt-auto flex flex-wrap items-center gap-x-3 gap-y-1 border-t border-gray-100 pt-3 text-xs text-ink/50">
                  <span className="inline-flex items-center gap-1">
                    <CalendarClock className="h-3.5 w-3.5" />
                    {m.upcomingSessions > 0
                      ? t("adminMentors.nextSession", { when: fmtSession(m.nextSessionAt) ?? "" })
                      : t("adminMentors.noSessions")}
                  </span>
                  <span>{lastSeen(m.lastSignedInAt, t)}</span>
                </div>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
