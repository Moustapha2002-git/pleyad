import { AlertTriangle, Users, Activity, TrendingUp, ShieldAlert } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { trpc } from "../lib/trpc";
import { DimensionGauges } from "../components/DimensionGauges";
import { Avatar, Badge, Card, EmptyState, PageHeader, ProgressBar, Spinner } from "../components/ui";

const REASON = {
  overdue: { label: "Overdue", badge: "bg-red-500/12 text-red-600" },
  not_started: { label: "Not started", badge: "bg-amber-500/15 text-amber-600" },
  inactive: { label: "Inactive 7d+", badge: "bg-gray-500/12 text-gray-500" },
} satisfies Record<string, { label: string; badge: string }>;

function StatCard({
  icon: Icon,
  label,
  value,
  hint,
  tone = "navy",
}: {
  icon: LucideIcon;
  label: string;
  value: string | number;
  hint?: string;
  tone?: "navy" | "gold" | "red" | "emerald";
}) {
  const tint = {
    navy: "bg-navy/10 text-navy",
    gold: "bg-gold/15 text-gold",
    red: "bg-red-500/12 text-red-600",
    emerald: "bg-emerald-500/12 text-emerald-600",
  }[tone];
  return (
    <Card className="p-5">
      <div className={`flex h-9 w-9 items-center justify-center rounded-xl ${tint}`}>
        <Icon className="h-5 w-5" />
      </div>
      <div className="mt-3 text-2xl font-bold text-navy-900">{value}</div>
      <div className="text-sm text-ink/55">{label}</div>
      {hint && <div className="mt-0.5 text-xs text-ink/40">{hint}</div>}
    </Card>
  );
}

function CompletionFunnel({
  funnel,
}: {
  funnel: { notStarted: number; inProgress: number; completed: number; total: number };
}) {
  const segments = [
    { key: "completed", label: "Completed", n: funnel.completed, bar: "bg-emerald-500", dot: "bg-emerald-500" },
    { key: "inProgress", label: "In progress", n: funnel.inProgress, bar: "bg-gold", dot: "bg-gold" },
    { key: "notStarted", label: "Not started", n: funnel.notStarted, bar: "bg-gray-300", dot: "bg-gray-300" },
  ];
  const pct = (n: number) => (funnel.total > 0 ? Math.round((n / funnel.total) * 100) : 0);
  return (
    <Card className="p-6">
      <div className="mb-4 flex items-baseline justify-between">
        <h2 className="text-base font-semibold text-navy-900">Path completion</h2>
        <span className="text-sm text-ink/45">{funnel.total} assigned</span>
      </div>
      <div className="flex h-3 w-full overflow-hidden rounded-full bg-gray-100">
        {segments.map((s) =>
          s.n > 0 ? (
            <div key={s.key} className={s.bar} style={{ width: `${pct(s.n)}%` }} title={`${s.label}: ${s.n}`} />
          ) : null,
        )}
      </div>
      <div className="mt-4 grid grid-cols-3 gap-3">
        {segments.map((s) => (
          <div key={s.key} className="flex items-center gap-2">
            <span className={`h-2.5 w-2.5 rounded-full ${s.dot}`} />
            <div>
              <div className="text-sm font-semibold text-navy-900">
                {s.n} <span className="font-normal text-ink/40">· {pct(s.n)}%</span>
              </div>
              <div className="text-xs text-ink/50">{s.label}</div>
            </div>
          </div>
        ))}
      </div>
    </Card>
  );
}

const relativeTime = (d: string | Date | null) => {
  if (!d) return "no activity yet";
  const days = Math.floor((Date.now() - new Date(d).getTime()) / 86_400_000);
  if (days <= 0) return "active today";
  if (days === 1) return "1 day ago";
  return `${days} days ago`;
};

export default function Analytics() {
  const me = trpc.auth.me.useQuery();
  const overview = trpc.analytics.cohort.useQuery();
  const orgName = me.data?.activeOrganization?.name ?? "Workspace";

  if (overview.isLoading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <Spinner label="Crunching cohort data…" />
      </div>
    );
  }
  const data = overview.data;
  if (!data) return null;

  const { totals, dimensions, funnel, atRisk } = data;
  const gauges = dimensions.map((d) => ({
    dimension: d.dimension,
    score: d.avgProgress,
    pathCount: d.learnerCount,
  }));

  return (
    <div className="space-y-8">
      <PageHeader title="Analytics" subtitle={`Cohort overview for ${orgName}`} />

      {totals.assignedPaths === 0 ? (
        <EmptyState
          icon={TrendingUp}
          title="No data to chart yet"
          description="Once learners are assigned learning paths and start making progress, cohort insights will appear here."
        />
      ) : (
        <>
          {/* Top-line stats */}
          <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
            <StatCard icon={Users} label="Learners" value={totals.learners} hint={`${totals.mentors} mentors`} />
            <StatCard
              icon={Activity}
              label="Active this week"
              value={totals.activeLearners}
              hint={`of ${totals.learners} learners`}
              tone="emerald"
            />
            <StatCard
              icon={TrendingUp}
              label="Avg. progress"
              value={`${totals.avgProgress}%`}
              hint={`${totals.assignedPaths} assigned paths`}
              tone="gold"
            />
            <StatCard
              icon={ShieldAlert}
              label="Learners at risk"
              value={atRisk.length}
              hint="overdue, stalled or inactive"
              tone={atRisk.length > 0 ? "red" : "navy"}
            />
          </div>

          {/* Dimension averages */}
          <section>
            <h2 className="mb-3 text-xs font-semibold uppercase tracking-wider text-gold">
              Cohort progress by dimension
            </h2>
            <DimensionGauges data={gauges} />
          </section>

          {/* Funnel */}
          <CompletionFunnel funnel={funnel} />

          {/* At-risk learners */}
          <section>
            <h2 className="mb-3 flex items-center gap-2 text-base font-semibold text-navy-900">
              <AlertTriangle className="h-4 w-4 text-red-500" /> Needs attention
            </h2>
            {atRisk.length === 0 ? (
              <Card className="p-6 text-sm text-ink/55">
                Everyone's on track — no overdue, stalled, or inactive learners. 🎉
              </Card>
            ) : (
              <Card className="divide-y divide-gray-100">
                {atRisk.map((l) => {
                  const r = REASON[l.reason];
                  return (
                    <div key={l.userId} className="flex items-center gap-4 p-4">
                      <Avatar name={l.name ?? l.email} />
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <span className="truncate font-medium text-navy-900">
                            {l.name ?? l.email}
                          </span>
                          <Badge className={r.badge}>{r.label}</Badge>
                        </div>
                        <div className="mt-0.5 text-xs text-ink/50">
                          {l.assignedCount} path{l.assignedCount === 1 ? "" : "s"}
                          {l.mentorName ? ` · mentor ${l.mentorName}` : " · no mentor"} ·{" "}
                          {relativeTime(l.lastActivityAt)}
                        </div>
                      </div>
                      <div className="hidden w-32 sm:block">
                        <div className="mb-1 text-right text-xs font-medium text-ink/50">
                          {l.avgProgress}%
                        </div>
                        <ProgressBar value={l.avgProgress} />
                      </div>
                    </div>
                  );
                })}
              </Card>
            )}
          </section>
        </>
      )}
    </div>
  );
}
