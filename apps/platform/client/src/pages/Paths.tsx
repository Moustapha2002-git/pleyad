import { useState } from "react";
import { ListMusic, Plus, Route as RouteIcon } from "lucide-react";
import { Link } from "wouter";
import { trpc } from "../lib/trpc";
import { DimensionChip } from "../components/DimensionGauges";
import { useToast } from "../components/Toast";
import {
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
  { key: "knowledge", label: "Knowledge" },
  { key: "skills", label: "Skills" },
  { key: "human_development", label: "Human Development" },
] as const;
type Dim = (typeof ALL_DIMENSIONS)[number]["key"];

type Tab = "paths" | "playlists";
type StatusFilter = "all" | "in_progress" | "completed" | "not_started";
const FILTERS: { key: StatusFilter; label: string }[] = [
  { key: "all", label: "All" },
  { key: "in_progress", label: "In progress" },
  { key: "completed", label: "Completed" },
  { key: "not_started", label: "Not started" },
];

function dueLabel(dueAt: string | Date | null | undefined) {
  if (!dueAt) return null;
  return new Date(dueAt).toLocaleDateString(undefined, { month: "short", day: "numeric" });
}
const isOverdue = (dueAt: string | Date | null | undefined, progress: number) =>
  !!dueAt && new Date(dueAt).getTime() < Date.now() && progress < 100;

const statusOf = (progress: number): StatusFilter =>
  progress >= 100 ? "completed" : progress === 0 ? "not_started" : "in_progress";

export default function Paths() {
  const me = trpc.auth.me.useQuery();
  const paths = trpc.paths.list.useQuery();
  const assigned = trpc.paths.assigned.useQuery();
  const playlists = trpc.playlists.mine.useQuery();
  const utils = trpc.useUtils();
  const toast = useToast();

  const [tab, setTab] = useState<Tab>("paths");
  const [filter, setFilter] = useState<StatusFilter>("all");

  const [title, setTitle] = useState("");
  const [dims, setDims] = useState<Dim[]>([]);
  const create = trpc.paths.create.useMutation({
    onSuccess: async () => {
      setTitle("");
      setDims([]);
      await utils.paths.list.invalidate();
      await utils.paths.progression.invalidate();
      toast.success("Path created");
    },
    onError: (e) => toast.error(e.message),
  });
  const toggle = (d: Dim) =>
    setDims((s) => (s.includes(d) ? s.filter((x) => x !== d) : [...s, d]));

  const [plTitle, setPlTitle] = useState("");
  const createPlaylist = trpc.playlists.create.useMutation({
    onSuccess: async () => {
      setPlTitle("");
      await utils.playlists.mine.invalidate();
      toast.success("Playlist created");
    },
    onError: (e) => toast.error(e.message),
  });

  const isTeamLearner =
    me.data?.activeOrganization?.type === "team" &&
    me.data?.activeOrganization?.role === "member";

  const rawList = (isTeamLearner ? (assigned.data ?? []) : (paths.data ?? [])).map((p) => ({
    id: p.id,
    title: p.title,
    progress: p.progress,
    completedCount: p.completedCount,
    itemCount: p.itemCount,
    dimensions: p.dimensions,
    dueAt: (p as { dueAt?: string | Date | null }).dueAt ?? null,
  }));
  const list = rawList.filter((p) => filter === "all" || statusOf(p.progress) === filter);
  const pathsLoading = isTeamLearner ? assigned.isLoading : paths.isLoading;

  return (
    <div className="space-y-6">
      <PageHeader
        title="My Learning"
        subtitle="Guided paths from your mentor, and playlists you build yourself."
      />

      {/* Tab bar */}
      <div className="flex gap-1 border-b border-gray-200">
        {([
          { key: "paths", label: isTeamLearner ? "Assigned paths" : "Paths", icon: RouteIcon },
          { key: "playlists", label: "My Playlists", icon: ListMusic },
        ] as const).map((t) => {
          const active = tab === t.key;
          const Icon = t.icon;
          return (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className={cn(
                "-mb-px flex items-center gap-1.5 border-b-2 px-3.5 py-2.5 text-sm font-medium transition",
                active
                  ? "border-navy-900 text-navy-900"
                  : "border-transparent text-ink/55 hover:text-navy",
              )}
            >
              <Icon className="h-4 w-4" /> {t.label}
            </button>
          );
        })}
      </div>

      {/* ── Paths tab ─────────────────────────────────────────────────── */}
      {tab === "paths" && (
        <div className="space-y-6">
          {!isTeamLearner && (
            <Card className="p-6">
              <h2 className="mb-4 text-base font-semibold text-navy-900">Create a path</h2>
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  if (title.trim()) create.mutate({ title: title.trim(), dimensions: dims });
                }}
                className="space-y-4"
              >
                <TextInput
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="Path title (e.g. Junior Developer Training)"
                />
                <div className="flex flex-wrap gap-2">
                  {ALL_DIMENSIONS.map((d) => (
                    <button
                      type="button"
                      key={d.key}
                      onClick={() => toggle(d.key)}
                      className={cn(
                        "rounded-full border px-3.5 py-1.5 text-sm font-medium transition",
                        dims.includes(d.key)
                          ? "border-navy-900 bg-navy-900 text-white"
                          : "border-gray-200 text-ink/70 hover:border-navy/40",
                      )}
                    >
                      {d.label}
                    </button>
                  ))}
                </div>
                <Button type="submit" disabled={create.isPending}>
                  {create.isPending ? "Creating…" : "Create path"}
                </Button>
              </form>
            </Card>
          )}

          {/* Status filter */}
          {rawList.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {FILTERS.map((f) => (
                <button
                  key={f.key}
                  onClick={() => setFilter(f.key)}
                  className={cn(
                    "rounded-full border px-3 py-1 text-sm font-medium transition",
                    filter === f.key
                      ? "border-navy-900 bg-navy-900 text-white"
                      : "border-gray-200 text-ink/60 hover:border-navy/40",
                  )}
                >
                  {f.label}
                </button>
              ))}
            </div>
          )}

          {pathsLoading ? (
            <ListSkeleton rows={3} />
          ) : list.length > 0 ? (
            <div className="space-y-3">
              {list.map((p) => (
                <Link key={p.id} to={`/paths/${p.id}`}>
                  <Card className="p-5 transition hover:-translate-y-0.5 hover:shadow-[var(--shadow-pop)]">
                    <div className="flex items-center justify-between gap-3">
                      <div className="flex items-center gap-2">
                        <span className="text-lg font-semibold text-navy-900">{p.title}</span>
                        {p.progress >= 100 ? (
                          <span className="rounded-full bg-emerald-500/12 px-2 py-0.5 text-xs font-medium text-emerald-600">
                            Completed
                          </span>
                        ) : (
                          dueLabel(p.dueAt) && (
                            <span
                              className={cn(
                                "rounded-full px-2 py-0.5 text-xs font-medium",
                                isOverdue(p.dueAt, p.progress)
                                  ? "bg-red-500/12 text-red-600"
                                  : "bg-gold/15 text-gold",
                              )}
                            >
                              {isOverdue(p.dueAt, p.progress) ? "Overdue" : `Due ${dueLabel(p.dueAt)}`}
                            </span>
                          )
                        )}
                      </div>
                      <span className="text-sm text-ink/50">
                        {p.completedCount}/{p.itemCount} done
                      </span>
                    </div>
                    {p.dimensions.length > 0 && (
                      <div className="mt-3 flex flex-wrap gap-2">
                        {p.dimensions.map((d) => (
                          <DimensionChip key={d} dimension={d} />
                        ))}
                      </div>
                    )}
                    <ProgressBar value={p.progress} className="mt-3" />
                  </Card>
                </Link>
              ))}
            </div>
          ) : (
            <EmptyState
              icon={RouteIcon}
              title={
                rawList.length > 0
                  ? "Nothing in this filter"
                  : isTeamLearner
                    ? "No paths assigned yet"
                    : "No paths yet"
              }
              description={
                rawList.length > 0
                  ? "Try a different status filter."
                  : isTeamLearner
                    ? "Your mentor will assign learning paths for you here."
                    : "Create your first learning path above to start tracking progress."
              }
            />
          )}
        </div>
      )}

      {/* ── Playlists tab ─────────────────────────────────────────────── */}
      {tab === "playlists" && (
        <div className="space-y-6">
          <Card className="p-6">
            <h2 className="mb-1 text-base font-semibold text-navy-900">Build your own playlist</h2>
            <p className="mb-4 text-sm text-ink/55">
              Collect courses from anywhere (YouTube, Coursera, edX…) and track them yourself.
            </p>
            <form
              onSubmit={(e) => {
                e.preventDefault();
                if (plTitle.trim()) createPlaylist.mutate({ title: plTitle.trim() });
              }}
              className="flex flex-col gap-2 sm:flex-row"
            >
              <TextInput
                value={plTitle}
                onChange={(e) => setPlTitle(e.target.value)}
                placeholder="Playlist name (e.g. My frontend deep-dive)"
                className="sm:flex-1"
              />
              <Button type="submit" icon={Plus} disabled={createPlaylist.isPending}>
                {createPlaylist.isPending ? "Creating…" : "New playlist"}
              </Button>
            </form>
          </Card>

          {playlists.isLoading ? (
            <ListSkeleton rows={2} />
          ) : playlists.data && playlists.data.length > 0 ? (
            <div className="space-y-3">
              {playlists.data.map((pl) => (
                <Link key={pl.id} to={`/playlists/${pl.id}`}>
                  <Card className="p-5 transition hover:-translate-y-0.5 hover:shadow-[var(--shadow-pop)]">
                    <div className="flex items-center justify-between gap-3">
                      <div className="flex items-center gap-2">
                        <ListMusic className="h-4 w-4 text-navy/50" />
                        <span className="text-lg font-semibold text-navy-900">{pl.title}</span>
                        {pl.progress >= 100 && pl.itemCount > 0 && (
                          <span className="rounded-full bg-emerald-500/12 px-2 py-0.5 text-xs font-medium text-emerald-600">
                            Completed
                          </span>
                        )}
                      </div>
                      <span className="text-sm text-ink/50">
                        {pl.completedCount}/{pl.itemCount} done
                      </span>
                    </div>
                    <ProgressBar value={pl.progress} className="mt-3" />
                  </Card>
                </Link>
              ))}
            </div>
          ) : (
            <EmptyState
              icon={ListMusic}
              title="No playlists yet"
              description="Create a playlist above and start collecting courses you want to learn."
            />
          )}
        </div>
      )}
    </div>
  );
}
