import { useState } from "react";
import {
  AlertTriangle,
  CalendarClock,
  ChevronRight,
  MessageSquare,
  Plus,
  Users,
} from "lucide-react";
import { Link, useLocation } from "wouter";
import { trpc } from "../lib/trpc";
import { useT } from "../lib/i18n";
import { useToast } from "../components/Toast";
import {
  Avatar,
  Button,
  Card,
  EmptyState,
  ListSkeleton,
  PageHeader,
  ProgressBar,
  TextInput,
  cn,
} from "../components/ui";

const ALL_DIMENSIONS = [
  { key: "knowledge" },
  { key: "skills" },
  { key: "human_development" },
] as const;
type Dim = (typeof ALL_DIMENSIONS)[number]["key"];

const RISK: Record<string, { labelKey: string; badge: string }> = {
  overdue: { labelKey: "mentorLearners.riskOverdue", badge: "bg-red-500/12 text-red-600" },
  not_started: {
    labelKey: "mentorLearners.riskNotStarted",
    badge: "bg-amber-500/15 text-amber-600",
  },
  inactive: { labelKey: "mentorLearners.riskInactive", badge: "bg-gray-500/12 text-gray-500" },
};

type T = (key: string, vars?: Record<string, string | number>) => string;

const isToday = (d: Date | string | null) => {
  if (!d) return false;
  const x = new Date(d);
  const n = new Date();
  return x.toDateString() === n.toDateString();
};

const lastActive = (d: Date | string | null, t: T) => {
  if (!d) return t("mentorLearners.noActivity");
  const days = Math.floor((Date.now() - new Date(d).getTime()) / 86_400_000);
  if (days <= 0) return t("mentorLearners.activeToday");
  if (days === 1) return t("mentorLearners.activeYesterday");
  return t("mentorLearners.activeDaysAgo", { n: days });
};

const sessionLabel = (d: Date | string | null, t: T) => {
  if (!d) return null;
  const x = new Date(d);
  const day = isToday(d)
    ? t("mentorLearners.today")
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
    <Card className="p-3 sm:p-4">
      <div className="flex items-center justify-between">
        <span className={`flex h-8 w-8 items-center justify-center rounded-lg ${tone}`}>
          <Icon className="h-4 w-4" />
        </span>
        <span className="text-2xl font-bold leading-none text-navy-900">{value}</span>
      </div>
      <div className="mt-2 text-[11px] leading-tight text-ink/55 sm:text-xs">{label}</div>
    </Card>
  );
}

export default function MentorLearners() {
  const { t } = useT();
  const stats = trpc.mentor.learnerStats.useQuery();
  const learners = stats.data ?? [];
  const [, navigate] = useLocation();
  const toast = useToast();

  // Create-a-path from the cockpit (mentors author paths, then assign them).
  const [showCreate, setShowCreate] = useState(false);
  const [title, setTitle] = useState("");
  const [dims, setDims] = useState<Dim[]>([]);
  const utils = trpc.useUtils();
  const createPath = trpc.paths.create.useMutation({
    onSuccess: async (res) => {
      await utils.paths.list.invalidate();
      toast.success(t("mentorLearners.pathCreated"));
      navigate(`/paths/${res.id}`);
    },
    onError: (e) => toast.error(e.message),
  });
  const toggleDim = (d: Dim) =>
    setDims((s) => (s.includes(d) ? s.filter((x) => x !== d) : [...s, d]));

  const atRisk = learners.filter((l) => l.atRisk).length;
  const unread = learners.reduce((s, l) => s + l.unread, 0);
  const sessionsToday = learners.filter((l) => isToday(l.nextSessionAt)).length;

  return (
    <div className="space-y-6">
      <PageHeader
        title={t("mentorLearners.title")}
        subtitle={t("mentorLearners.subtitle")}
        action={
          <Button icon={Plus} variant="secondary" onClick={() => setShowCreate((s) => !s)}>
            {showCreate ? t("common.close") : t("mentorLearners.newPath")}
          </Button>
        }
      />

      {/* Inline path builder — create here, add steps on the detail page, then assign */}
      {showCreate && (
        <Card className="p-6">
          <h2 className="mb-1 text-base font-semibold text-navy-900">
            {t("mentorLearners.createTitle")}
          </h2>
          <p className="mb-4 text-sm text-ink/55">{t("mentorLearners.createHint")}</p>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              if (title.trim()) createPath.mutate({ title: title.trim(), dimensions: dims });
            }}
            className="space-y-4"
          >
            <TextInput
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder={t("mentorLearners.pathTitlePlaceholder")}
            />
            <div className="flex flex-wrap gap-2">
              {ALL_DIMENSIONS.map((d) => (
                <button
                  type="button"
                  key={d.key}
                  onClick={() => toggleDim(d.key)}
                  className={cn(
                    "rounded-full border px-3.5 py-1.5 text-sm font-medium transition",
                    dims.includes(d.key)
                      ? "border-navy-900 bg-navy-900 text-white"
                      : "border-gray-200 text-ink/70 hover:border-navy/40",
                  )}
                >
                  {t("dimensions." + d.key)}
                </button>
              ))}
            </div>
            <Button type="submit" disabled={!title.trim() || createPath.isPending}>
              {createPath.isPending
                ? t("mentorLearners.creating")
                : t("mentorLearners.createAndAddSteps")}
            </Button>
          </form>
        </Card>
      )}

      {stats.isLoading ? (
        <ListSkeleton rows={4} />
      ) : learners.length > 0 ? (
        <>
          {/* Today strip */}
          <div className="grid grid-cols-3 gap-3">
            <Metric
              icon={CalendarClock}
              value={sessionsToday}
              label={t("mentorLearners.sessionsToday")}
              tone="bg-gold/15 text-gold"
            />
            <Metric
              icon={MessageSquare}
              value={unread}
              label={t("mentorLearners.unreadMessages")}
              tone="bg-navy/10 text-navy"
            />
            <Metric
              icon={AlertTriangle}
              value={atRisk}
              label={t("mentorLearners.needAttention")}
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
                            {t(r.labelKey)}
                          </span>
                        )}
                        {l.unread > 0 && (
                          <span className="inline-flex items-center gap-1 rounded-full bg-navy-900 px-2 py-0.5 text-xs font-medium text-white">
                            <MessageSquare className="h-3 w-3" /> {l.unread}
                          </span>
                        )}
                      </div>
                      <div className="mt-0.5 truncate text-xs text-ink/50">
                        {l.assignedCount === 1
                          ? t("mentorLearners.pathCountOne", { n: l.assignedCount })
                          : t("mentorLearners.pathCount", { n: l.assignedCount })}{" "}
                        · {lastActive(l.lastActivityAt, t)}
                        {l.nextSessionAt &&
                          ` · ${t("mentorLearners.nextSession", { when: sessionLabel(l.nextSessionAt, t) ?? "" })}`}
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
          title={t("mentorLearners.emptyTitle")}
          description={t("mentorLearners.emptyDesc")}
        />
      )}
    </div>
  );
}
