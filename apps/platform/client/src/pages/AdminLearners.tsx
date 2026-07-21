import { useEffect, useState } from "react";
import {
  Ban,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Eye,
  GraduationCap,
  Search,
  TrendingUp,
  UserMinus,
  Users,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { Link } from "wouter";
import { trpc } from "../lib/trpc";
import { dateLocale, useT } from "../lib/i18n";
import { useToast } from "../components/Toast";
import {
  Avatar,
  Button,
  Card,
  EmptyState,
  ListSkeleton,
  PageHeader,
  ProgressBar,
  Select,
  TextInput,
  cn,
} from "../components/ui";

type StatusFilter = "all" | "active" | "inactive" | "completed" | "suspended";
type Sort = "name" | "progress" | "recent" | "newest";

const FILTERS: { key: StatusFilter; labelKey: string }[] = [
  { key: "all", labelKey: "adminLearners.filterAll" },
  { key: "active", labelKey: "adminLearners.filterActive" },
  { key: "inactive", labelKey: "adminLearners.filterInactive" },
  { key: "completed", labelKey: "adminLearners.filterCompleted" },
  { key: "suspended", labelKey: "adminLearners.filterSuspended" },
];

type T = (key: string, vars?: Record<string, string | number>) => string;

const fmtDate = (d: string | Date | null) =>
  d ? new Date(d).toLocaleDateString(dateLocale(), { month: "short", day: "numeric", year: "numeric" }) : "—";
const lastActive = (d: string | Date | null, t: T) => {
  if (!d) return t("adminLearners.noActivity");
  const days = Math.floor((Date.now() - new Date(d).getTime()) / 86_400_000);
  if (days <= 0) return t("adminLearners.activeToday");
  if (days === 1) return t("adminLearners.activeYesterday");
  return t("adminLearners.activeDaysAgo", { n: days });
};

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

export default function AdminLearners() {
  const { t } = useT();
  const toast = useToast();
  const utils = trpc.useUtils();

  const [search, setSearch] = useState("");
  const [debounced, setDebounced] = useState("");
  const [status, setStatus] = useState<StatusFilter>("all");
  const [mentorId, setMentorId] = useState("");
  const [sort, setSort] = useState<Sort>("name");
  const [page, setPage] = useState(1);

  // Debounce search; any filter change resets to page 1.
  useEffect(() => {
    const t = setTimeout(() => setDebounced(search), 300);
    return () => clearTimeout(t);
  }, [search]);
  useEffect(() => setPage(1), [debounced, status, mentorId, sort]);

  const members = trpc.admin.members.useQuery();
  const mentors = (members.data ?? []).filter((m) =>
    ["mentor", "admin", "owner"].includes(m.role),
  );

  const learners = trpc.admin.learners.useQuery({
    search: debounced || undefined,
    status,
    mentorUserId: mentorId ? Number(mentorId) : undefined,
    sort,
    page,
  });

  const refresh = () => utils.admin.learners.invalidate();
  const setLearnerStatus = trpc.admin.setLearnerStatus.useMutation({
    onSuccess: (_r, vars) => {
      refresh();
      toast.success(
        vars.status === "suspended"
          ? t("adminLearners.learnerSuspended")
          : t("adminLearners.learnerReactivated"),
      );
    },
    onError: (e) => toast.error(e.message),
  });
  const removeLearner = trpc.admin.removeLearner.useMutation({
    onSuccess: () => {
      refresh();
      utils.admin.members.invalidate();
      toast.info(t("adminLearners.learnerRemoved"));
    },
    onError: (e) => toast.error(e.message),
  });

  const data = learners.data;
  const stats = data?.stats;

  return (
    <div className="space-y-6">
      <PageHeader title={t("adminLearners.title")} subtitle={t("adminLearners.subtitle")} />

      {/* Stats */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat icon={Users} value={stats?.total ?? "…"} label={t("adminLearners.statTotal")} />
        <Stat
          icon={GraduationCap}
          value={stats?.active ?? "…"}
          label={t("adminLearners.statActive")}
          tone="bg-emerald-500/12 text-emerald-600"
        />
        <Stat
          icon={CheckCircle2}
          value={stats?.completed ?? "…"}
          label={t("adminLearners.statCompleted")}
          tone="bg-gold/15 text-gold"
        />
        <Stat
          icon={TrendingUp}
          value={`${stats?.avgProgress ?? "…"}%`}
          label={t("adminLearners.statAvgProgress")}
          tone="bg-dim-knowledge/10 text-dim-knowledge"
        />
      </div>

      {/* Controls */}
      <div className="flex flex-col gap-3">
        <div className="flex flex-col gap-2 sm:flex-row">
          <div className="relative sm:flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink/35" />
            <TextInput
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={t("adminLearners.searchPlaceholder")}
              className="pl-9"
            />
          </div>
          <Select value={mentorId} onChange={(e) => setMentorId(e.target.value)}>
            <option value="">{t("adminLearners.anyMentor")}</option>
            {mentors.map((m) => (
              <option key={m.userId} value={m.userId}>
                {t("adminLearners.mentorOption", { name: m.name ?? m.email ?? "" })}
              </option>
            ))}
          </Select>
          <Select value={sort} onChange={(e) => setSort(e.target.value as Sort)}>
            <option value="name">{t("adminLearners.sortName")}</option>
            <option value="progress">{t("adminLearners.sortProgress")}</option>
            <option value="recent">{t("adminLearners.sortRecent")}</option>
            <option value="newest">{t("adminLearners.sortNewest")}</option>
          </Select>
        </div>
        <div className="flex flex-wrap gap-2">
          {FILTERS.map((f) => (
            <button
              key={f.key}
              onClick={() => setStatus(f.key)}
              className={cn(
                "rounded-full border px-3 py-1 text-sm font-medium transition",
                status === f.key
                  ? "border-navy-900 bg-navy-900 text-white"
                  : "border-gray-200 text-ink/60 hover:border-navy/40",
              )}
            >
              {t(f.labelKey)}
            </button>
          ))}
        </div>
      </div>

      {/* Cards */}
      {learners.isLoading ? (
        <ListSkeleton rows={4} />
      ) : (data?.rows.length ?? 0) === 0 ? (
        <EmptyState
          icon={Users}
          title={t("adminLearners.emptyTitle")}
          description={t("adminLearners.emptyDesc")}
        />
      ) : (
        <>
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {data!.rows.map((l) => {
              const suspended = l.membershipStatus === "suspended";
              const completed = l.assignedCount > 0 && l.avgProgress === 100;
              return (
                <Card key={l.userId} className={cn("p-5", suspended && "opacity-70")}>
                  <div className="flex items-start gap-3">
                    <Avatar name={l.name ?? l.email} className="h-11 w-11" />
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-1.5">
                        <span className="truncate font-semibold text-navy-900">
                          {l.name ?? l.email}
                        </span>
                        {suspended ? (
                          <span className="rounded-full bg-red-500/12 px-2 py-0.5 text-[11px] font-medium text-red-600">
                            {t("adminLearners.suspended")}
                          </span>
                        ) : completed ? (
                          <span className="rounded-full bg-emerald-500/12 px-2 py-0.5 text-[11px] font-medium text-emerald-600">
                            {t("adminLearners.completed")}
                          </span>
                        ) : (
                          <span className="rounded-full bg-navy/10 px-2 py-0.5 text-[11px] font-medium text-navy/70">
                            {l.lastActivityAt
                              ? t("adminLearners.active")
                              : t("adminLearners.notStarted")}
                          </span>
                        )}
                      </div>
                      <div className="truncate text-xs text-ink/50">{l.email}</div>
                    </div>
                  </div>

                  <div className="mt-4 flex items-center gap-2">
                    <ProgressBar value={l.avgProgress} className="flex-1" />
                    <span className="text-sm font-semibold text-navy-900">{l.avgProgress}%</span>
                  </div>

                  <div className="mt-2 text-xs text-ink/50">
                    {l.assignedCount === 1
                      ? t("adminLearners.pathCountOne", { n: l.assignedCount })
                      : t("adminLearners.pathCount", { n: l.assignedCount })}{" "}
                    · {t("adminLearners.completedCount", { n: l.completedCount })} ·{" "}
                    {l.mentors.length > 0
                      ? t("adminLearners.mentorLabel", {
                          names: l.mentors.map((m) => m.name ?? "?").join(", "),
                        })
                      : t("adminLearners.noMentor")}
                  </div>
                  <div className="mt-0.5 text-xs text-ink/40">
                    {lastActive(l.lastActivityAt, t)} ·{" "}
                    {t("adminLearners.joined", { date: fmtDate(l.joinedAt) })}
                  </div>

                  <div className="mt-4 flex items-center gap-2 border-t border-gray-100 pt-3">
                    <Link
                      to={`/mentor/${l.userId}`}
                      className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-lg border border-gray-200 px-3 py-1.5 text-xs font-medium text-navy/70 transition hover:bg-gray-50 hover:text-navy"
                    >
                      <Eye className="h-3.5 w-3.5" /> {t("adminLearners.viewProfile")}
                    </Link>
                    <button
                      onClick={() =>
                        setLearnerStatus.mutate({
                          userId: l.userId,
                          status: suspended ? "active" : "suspended",
                        })
                      }
                      className={cn(
                        "inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-medium transition",
                        suspended
                          ? "border-emerald-200 text-emerald-600 hover:bg-emerald-50"
                          : "border-gray-200 text-ink/60 hover:bg-gray-50",
                      )}
                      title={suspended ? t("adminLearners.reactivate") : t("adminLearners.suspend")}
                    >
                      <Ban className="h-3.5 w-3.5" />
                      {suspended ? t("adminLearners.reactivate") : t("adminLearners.suspend")}
                    </button>
                    <button
                      onClick={() => {
                        if (
                          window.confirm(
                            t("adminLearners.removeConfirm", { name: l.name ?? l.email ?? "" }),
                          )
                        )
                          removeLearner.mutate({ userId: l.userId });
                      }}
                      className="inline-flex items-center rounded-lg border border-gray-200 p-1.5 text-ink/50 transition hover:bg-red-50 hover:text-red-600"
                      aria-label={t("adminLearners.removeAria")}
                    >
                      <UserMinus className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </Card>
              );
            })}
          </div>

          {/* Pagination */}
          {data!.pageCount > 1 && (
            <div className="flex items-center justify-between">
              <span className="text-sm text-ink/50">
                {data!.totalFiltered === 1
                  ? t("adminLearners.pageInfoOne", {
                      n: data!.totalFiltered,
                      page: data!.page,
                      pages: data!.pageCount,
                    })
                  : t("adminLearners.pageInfo", {
                      n: data!.totalFiltered,
                      page: data!.page,
                      pages: data!.pageCount,
                    })}
              </span>
              <div className="flex gap-2">
                <Button
                  variant="secondary"
                  icon={ChevronLeft}
                  disabled={page <= 1}
                  onClick={() => setPage((p) => p - 1)}
                >
                  {t("adminLearners.prev")}
                </Button>
                <Button
                  variant="secondary"
                  icon={ChevronRight}
                  disabled={page >= data!.pageCount}
                  onClick={() => setPage((p) => p + 1)}
                >
                  {t("adminLearners.next")}
                </Button>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
