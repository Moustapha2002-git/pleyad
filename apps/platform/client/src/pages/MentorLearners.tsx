import { AlertTriangle, CalendarClock, ChevronRight, MessageSquare, Users } from "lucide-react";
import { Link } from "wouter";
import { trpc } from "../lib/trpc";
import {
  Avatar,
  Card,
  EmptyState,
  ListSkeleton,
  PageHeader,
  ProgressBar,
} from "../components/ui";

const RISK: Record<string, { label: string; badge: string }> = {
  overdue: { label: "Overdue", badge: "bg-red-500/12 text-red-600" },
  not_started: { label: "Not started", badge: "bg-amber-500/15 text-amber-600" },
  inactive: { label: "Inactive 7d+", badge: "bg-gray-500/12 text-gray-500" },
};

const isToday = (d: Date | string | null) => {
  if (!d) return false;
  const x = new Date(d);
  const n = new Date();
  return x.toDateString() === n.toDateString();
};

const lastActive = (d: Date | string | null) => {
  if (!d) return "no activity yet";
  const days = Math.floor((Date.now() - new Date(d).getTime()) / 86_400_000);
  if (days <= 0) return "active today";
  if (days === 1) return "active yesterday";
  return `active ${days}d ago`;
};

const sessionLabel = (d: Date | string | null) => {
  if (!d) return null;
  const x = new Date(d);
  const day = isToday(d)
    ? "today"
    : x.toLocaleDateString(undefined, { month: "short", day: "numeric" });
  const time = x.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
  return `${day} · ${time}`;
};

function Metric({
  icon: Icon,
  value,
  label,
  tone,
}: {
  icon: typeof Users;
  value: number;
  label: string;
  tone: string;
}) {
  return (
    <Card className="flex items-center gap-3 p-4">
      <div className={`flex h-10 w-10 items-center justify-center rounded-xl ${tone}`}>
        <Icon className="h-5 w-5" />
      </div>
      <div>
        <div className="text-xl font-bold text-navy-900">{value}</div>
        <div className="text-xs text-ink/55">{label}</div>
      </div>
    </Card>
  );
}

export default function MentorLearners() {
  const stats = trpc.mentor.learnerStats.useQuery();
  const learners = stats.data ?? [];

  const atRisk = learners.filter((l) => l.atRisk).length;
  const unread = learners.reduce((s, l) => s + l.unread, 0);
  const sessionsToday = learners.filter((l) => isToday(l.nextSessionAt)).length;

  return (
    <div className="space-y-6">
      <PageHeader title="My learners" subtitle="Everyone you're mentoring, at a glance." />

      {stats.isLoading ? (
        <ListSkeleton rows={4} />
      ) : learners.length > 0 ? (
        <>
          {/* Today strip */}
          <div className="grid grid-cols-3 gap-3">
            <Metric
              icon={CalendarClock}
              value={sessionsToday}
              label="Sessions today"
              tone="bg-gold/15 text-gold"
            />
            <Metric
              icon={MessageSquare}
              value={unread}
              label="Unread messages"
              tone="bg-navy/10 text-navy"
            />
            <Metric
              icon={AlertTriangle}
              value={atRisk}
              label="Need attention"
              tone={atRisk > 0 ? "bg-red-500/12 text-red-600" : "bg-emerald-500/12 text-emerald-600"}
            />
          </div>

          {/* Learner rows */}
          <div className="space-y-3">
            {learners.map((l) => {
              const r = l.atRisk ? RISK[l.atRisk] : null;
              return (
                <Link key={l.id} to={`/mentor/${l.id}`}>
                  <Card className="flex items-center gap-4 p-4 transition hover:-translate-y-0.5 hover:shadow-[var(--shadow-pop)]">
                    <Avatar name={l.name ?? l.email} className="h-11 w-11" />
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-semibold text-navy-900">{l.name ?? l.email}</span>
                        {r && (
                          <span
                            className={`rounded-full px-2 py-0.5 text-xs font-medium ${r.badge}`}
                          >
                            {r.label}
                          </span>
                        )}
                        {l.unread > 0 && (
                          <span className="inline-flex items-center gap-1 rounded-full bg-navy-900 px-2 py-0.5 text-xs font-medium text-white">
                            <MessageSquare className="h-3 w-3" /> {l.unread}
                          </span>
                        )}
                      </div>
                      <div className="mt-0.5 truncate text-xs text-ink/50">
                        {l.assignedCount} path{l.assignedCount === 1 ? "" : "s"} · {lastActive(l.lastActivityAt)}
                        {l.nextSessionAt && ` · next ${sessionLabel(l.nextSessionAt)}`}
                      </div>
                    </div>
                    <div className="hidden w-28 sm:block">
                      <div className="mb-1 text-right text-xs font-medium text-ink/50">
                        {l.progress}%
                      </div>
                      <ProgressBar value={l.progress} />
                    </div>
                    <ChevronRight className="h-5 w-5 shrink-0 text-ink/30" />
                  </Card>
                </Link>
              );
            })}
          </div>
        </>
      ) : (
        <EmptyState
          icon={Users}
          title="No learners assigned yet"
          description="Learners assigned to you will appear here with their progress and activity."
        />
      )}
    </div>
  );
}
