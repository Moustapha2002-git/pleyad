import { useMemo, useState } from "react";
import {
  Award,
  BookOpen,
  CheckCircle2,
  Flame,
  ListChecks,
  ListMusic,
  Play,
  Plus,
  Route as RouteIcon,
  Search,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { Link, useLocation } from "wouter";
import { trpc } from "../lib/trpc";
import { useT } from "../lib/i18n";
import { PathCard } from "../components/PathCard";
import type { PathCardData } from "../components/PathCard";
import { useToast } from "../components/Toast";
import { thumbnailFor } from "../lib/thumbnails";
import {
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

const ALL_DIMENSIONS = [
  { key: "knowledge", label: "Knowledge" },
  { key: "skills", label: "Skills" },
  { key: "human_development", label: "Human Dev" },
] as const;
type Dim = (typeof ALL_DIMENSIONS)[number]["key"];

type Tab = "paths" | "playlists";
type StatusFilter = "all" | "in_progress" | "completed" | "not_started";
type Sort = "recent" | "title" | "progress" | "due";

const STATUS_FILTERS: { key: StatusFilter; label: string }[] = [
  { key: "all", label: "All" },
  { key: "in_progress", label: "In progress" },
  { key: "completed", label: "Completed" },
  { key: "not_started", label: "Not started" },
];

type Row = PathCardData & { dimensions?: string[] };

const statusOf = (p: Row): StatusFilter =>
  p.itemCount > 0 && p.progress >= 100
    ? "completed"
    : p.progress === 0
      ? "not_started"
      : "in_progress";
const dueTs = (d: string | Date | null | undefined) => (d ? new Date(d).getTime() : Infinity);
const lastTs = (d: string | Date | null | undefined) => (d ? new Date(d).getTime() : 0);

function StatTile({
  icon: Icon,
  value,
  label,
  tone = "bg-navy/10 text-navy",
}: {
  icon: LucideIcon;
  value: string | number;
  label: string;
  tone?: string;
}) {
  return (
    <Card className="p-3 transition hover:-translate-y-0.5 hover:shadow-[var(--shadow-pop)] sm:p-4">
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

export default function Paths() {
  const [, navigate] = useLocation();
  const { t } = useT();
  const me = trpc.auth.me.useQuery();
  const pathsQ = trpc.paths.list.useQuery();
  const assignedQ = trpc.paths.assigned.useQuery();
  const playlistsQ = trpc.playlists.mine.useQuery();
  const quizzesQ = trpc.quizzes.mine.useQuery();
  const utils = trpc.useUtils();
  const toast = useToast();

  const [tab, setTab] = useState<Tab>("paths");
  const [status, setStatus] = useState<StatusFilter>("all");
  const [dim, setDim] = useState<Dim | "all">("all");
  const [search, setSearch] = useState("");
  const [sort, setSort] = useState<Sort>("recent");

  // Creation (personal workspaces author their own paths)
  const [showCreate, setShowCreate] = useState(false);
  const [title, setTitle] = useState("");
  const [dims, setDims] = useState<Dim[]>([]);
  const create = trpc.paths.create.useMutation({
    onSuccess: async (res) => {
      setTitle("");
      setDims([]);
      setShowCreate(false);
      await utils.paths.list.invalidate();
      toast.success("Path created — add its first skill");
      navigate(`/paths/${res.id}`);
    },
    onError: (e) => toast.error(e.message),
  });
  const toggleDim = (d: Dim) =>
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

  const inTeam = me.data?.activeOrganization?.type === "team";
  const isTeamLearner = inTeam && me.data?.activeOrganization?.role === "member";
  const showPlaylists = !inTeam || isTeamLearner;

  const rows: Row[] = (isTeamLearner ? (assignedQ.data ?? []) : (pathsQ.data ?? [])).filter(
    (p) => p.itemCount > 0 || !isTeamLearner,
  );
  const playlists: Row[] = playlistsQ.data ?? [];
  const loading = isTeamLearner ? assignedQ.isLoading : pathsQ.isLoading;

  // ── Derived: hero + stats (all real) ────────────────────────────────────
  const hero = useMemo(() => {
    const inProgress = rows
      .filter((p) => p.progress > 0 && p.progress < 100)
      .sort((a, b) => dueTs(a.dueAt) - dueTs(b.dueAt) || b.progress - a.progress);
    const notStarted = rows.filter((p) => p.progress === 0 && p.itemCount > 0);
    return inProgress[0] ?? notStarted[0] ?? null;
  }, [rows]);

  const takenQuizzes = (quizzesQ.data ?? []).filter((q) => q.taken && q.score != null);
  const avgQuiz = takenQuizzes.length
    ? Math.round(takenQuizzes.reduce((s, q) => s + (q.score ?? 0), 0) / takenQuizzes.length)
    : null;
  const allRows = [...rows, ...playlists];
  const stats = {
    total: rows.length,
    inProgress: rows.filter((p) => statusOf(p) === "in_progress").length,
    completed: rows.filter((p) => statusOf(p) === "completed").length,
    skillsMastered: allRows.reduce((s, p) => s + p.completedCount, 0),
  };

  // ── Filtering + sorting ─────────────────────────────────────────────────
  const filterRows = (list: Row[]) => {
    const q = search.trim().toLowerCase();
    let out = list.filter((p) => {
      if (q && !p.title.toLowerCase().includes(q)) return false;
      if (status !== "all" && statusOf(p) !== status) return false;
      if (dim !== "all" && !(p.dimensions ?? []).includes(dim)) return false;
      return true;
    });
    out = [...out].sort((a, b) => {
      switch (sort) {
        case "title":
          return a.title.localeCompare(b.title);
        case "progress":
          return b.progress - a.progress;
        case "due":
          return dueTs(a.dueAt) - dueTs(b.dueAt);
        default:
          return lastTs(b.lastActivityAt) - lastTs(a.lastActivityAt);
      }
    });
    return out;
  };
  const visiblePaths = filterRows(rows);
  const visiblePlaylists = filterRows(playlists);

  const continueLink = (p: Row, base: "/paths" | "/playlists") =>
    p.nextSkill ? `${base}/${p.id}/learn/${p.nextSkill.resourceId}` : null;

  const heroThumb = hero?.previewSkills?.length
    ? thumbnailFor(hero.previewSkills[0]!.url, hero.previewSkills[0]!.thumbnailUrl)
    : null;

  return (
    <div className="space-y-7">
      <PageHeader
        title={showPlaylists ? t("learning.title") : t("learning.titleAuthor")}
        subtitle={
          isTeamLearner
            ? t("learning.subtitleLearner")
            : showPlaylists
              ? t("learning.subtitlePersonal")
              : t("learning.subtitleAuthor")
        }
        action={
          !isTeamLearner ? (
            <Button icon={Plus} variant="secondary" onClick={() => setShowCreate((s) => !s)}>
              {showCreate ? t("common.close") : t("learning.newPath")}
            </Button>
          ) : undefined
        }
      />

      {/* Path creator (personal workspaces) */}
      {showCreate && !isTeamLearner && (
        <Card className="p-6">
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
              placeholder={t("learning.pathTitlePlaceholder")}
              aria-label="New path title"
            />
            <div className="flex flex-wrap gap-2">
              {ALL_DIMENSIONS.map((d) => (
                <button
                  type="button"
                  key={d.key}
                  onClick={() => toggleDim(d.key)}
                  aria-pressed={dims.includes(d.key)}
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
            <Button type="submit" disabled={!title.trim() || create.isPending}>
              {create.isPending ? t("learning.creating") : t("learning.createPath")}
            </Button>
          </form>
        </Card>
      )}

      {loading ? (
        <ListSkeleton rows={4} />
      ) : (
        <>
          {/* ── Continue learning hero ─────────────────────────────── */}
          {hero && (
            <section aria-label="Continue learning">
              <div className="overflow-hidden rounded-2xl bg-navy-950 text-white shadow-[var(--shadow-pop)]">
                <div className="flex flex-col sm:flex-row">
                  <div className="relative h-40 w-full shrink-0 sm:h-auto sm:w-72">
                    {heroThumb ? (
                      <img src={heroThumb} alt="" className="h-full w-full object-cover" />
                    ) : (
                      <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-navy-700 to-navy-950 text-xs font-bold uppercase tracking-widest text-white/40">
                        {hero.title.slice(0, 24)}
                      </div>
                    )}
                    <span className="absolute inset-x-0 bottom-0 h-1 bg-black/40">
                      <span
                        className="block h-full bg-gold transition-[width] duration-700"
                        style={{ width: `${hero.progress}%` }}
                      />
                    </span>
                  </div>
                  <div className="flex min-w-0 flex-1 flex-col justify-center gap-2 p-5 sm:p-6">
                    <div className="text-[11px] font-bold uppercase tracking-[0.2em] text-gold">
                      {hero.progress > 0 ? t("learning.heroContinue") : t("learning.heroStart")}
                    </div>
                    <h2 className="text-xl font-bold leading-tight">{hero.title}</h2>
                    {hero.nextSkill && (
                      <p className="truncate text-sm text-white/60">
                        {t("learning.heroNext", { title: hero.nextSkill.title })}
                      </p>
                    )}
                    <div className="mt-1 flex items-center gap-3">
                      <ProgressBar
                        value={hero.progress}
                        className="max-w-56 flex-1 bg-white/15"
                      />
                      <span className="text-sm font-semibold">{hero.progress}%</span>
                    </div>
                    <div className="mt-2">
                      <Link
                        to={
                          continueLink(hero, "/paths") ?? `/paths/${hero.id}`
                        }
                        className="inline-flex items-center gap-2 rounded-xl bg-gold px-5 py-2.5 text-sm font-bold text-navy-950 transition hover:brightness-105 focus:outline-none focus:ring-2 focus:ring-gold/60"
                      >
                        <Play className="h-4 w-4" fill="currentColor" />
                        {hero.progress > 0 ? t("learning.heroResume") : t("learning.heroStartNow")}
                      </Link>
                    </div>
                  </div>
                </div>
              </div>
            </section>
          )}

          {/* ── Stats strip ────────────────────────────────────────── */}
          <section aria-label="Learning statistics" className="grid grid-cols-2 gap-3 lg:grid-cols-5">
            <StatTile icon={BookOpen} value={stats.total} label={t("learning.statPaths")} />
            <StatTile
              icon={Flame}
              value={stats.inProgress}
              label={t("learning.statInProgress")}
              tone="bg-gold/15 text-gold"
            />
            <StatTile
              icon={CheckCircle2}
              value={stats.completed}
              label={t("learning.statCompleted")}
              tone="bg-emerald-500/12 text-emerald-600"
            />
            <StatTile
              icon={Award}
              value={stats.skillsMastered}
              label={t("learning.statSkills")}
              tone="bg-dim-knowledge/10 text-dim-knowledge"
            />
            <StatTile
              icon={ListChecks}
              value={avgQuiz != null ? `${avgQuiz}%` : "—"}
              label={t("learning.statQuiz")}
              tone="bg-dim-human/10 text-dim-human"
            />
          </section>

          {/* ── Tabs (paths / playlists) ───────────────────────────── */}
          {showPlaylists && (
            <div className="flex gap-1 border-b border-gray-200" role="tablist">
              {(
                [
                  { key: "paths", label: isTeamLearner ? t("learning.tabAssigned") : t("learning.tabPaths"), icon: RouteIcon },
                  { key: "playlists", label: t("learning.tabPlaylists"), icon: ListMusic },
                ] as const
              ).map((t) => {
                const active = tab === t.key;
                const Icon = t.icon;
                return (
                  <button
                    key={t.key}
                    role="tab"
                    aria-selected={active}
                    onClick={() => setTab(t.key)}
                    className={cn(
                      "-mb-px flex items-center gap-1.5 border-b-2 px-3.5 py-2.5 text-sm font-medium transition focus:outline-none focus-visible:ring-2 focus-visible:ring-navy/30",
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
          )}

          {/* ── Controls: search / sort / filters ──────────────────── */}
          <div className="flex flex-col gap-3">
            <div className="flex flex-col gap-2 sm:flex-row">
              <div className="relative sm:flex-1">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink/35" />
                <TextInput
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder={t("learning.searchPlaceholder")}
                  aria-label="Search paths"
                  className="pl-9"
                />
              </div>
              <Select
                value={sort}
                onChange={(e) => setSort(e.target.value as Sort)}
                aria-label="Sort paths"
              >
                <option value="recent">{t("learning.sortRecent")}</option>
                <option value="due">{t("learning.sortDue")}</option>
                <option value="progress">{t("learning.sortProgress")}</option>
                <option value="title">{t("learning.sortTitle")}</option>
              </Select>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              {STATUS_FILTERS.map((f) => (
                <button
                  key={f.key}
                  onClick={() => setStatus(f.key)}
                  aria-pressed={status === f.key}
                  className={cn(
                    "rounded-full border px-3 py-1 text-sm font-medium transition focus:outline-none focus-visible:ring-2 focus-visible:ring-navy/30",
                    status === f.key
                      ? "border-navy-900 bg-navy-900 text-white"
                      : "border-gray-200 text-ink/60 hover:border-navy/40",
                  )}
                >
                  {t("learning.filter" + f.key.replace(/(^.|_.)/g, (m) => m.replace("_", "").toUpperCase()))}
                </button>
              ))}
              <span className="mx-1 hidden h-4 w-px bg-gray-200 sm:block" aria-hidden />
              {[{ key: "all" as const, label: "All skills" }, ...ALL_DIMENSIONS].map((d) => (
                <button
                  key={d.key}
                  onClick={() => setDim(d.key as Dim | "all")}
                  aria-pressed={dim === d.key}
                  className={cn(
                    "rounded-full border px-3 py-1 text-sm font-medium transition focus:outline-none focus-visible:ring-2 focus-visible:ring-navy/30",
                    dim === d.key
                      ? "border-gold bg-gold/15 text-gold"
                      : "border-gray-200 text-ink/60 hover:border-gold/60",
                  )}
                >
                  {d.key === "all" ? t("learning.allSkills") : d.label}
                </button>
              ))}
            </div>
          </div>

          {/* ── Path grid ──────────────────────────────────────────── */}
          {tab === "paths" &&
            (visiblePaths.length > 0 ? (
              <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
                {visiblePaths.map((p) => (
                  <PathCard
                    key={p.id}
                    p={p}
                    detailTo={`/paths/${p.id}`}
                    continueTo={continueLink(p, "/paths")}
                  />
                ))}
              </div>
            ) : (
              <EmptyState
                icon={RouteIcon}
                title={rows.length > 0 ? t("learning.noMatchTitle") : t("learning.noPathsTitle")}
                description={
                  rows.length > 0
                    ? t("learning.noMatchDesc")
                    : isTeamLearner
                      ? t("learning.noPathsAssignedDesc")
                      : t("learning.noPathsPersonalDesc")
                }
                action={
                  rows.length === 0 ? (
                    isTeamLearner ? (
                      <Link to="/mentoring">
                        <Button>{t("learning.meetMentorBtn")}</Button>
                      </Link>
                    ) : (
                      <Button icon={Plus} onClick={() => setShowCreate(true)}>
                        {t("learning.createFirstPath")}
                      </Button>
                    )
                  ) : undefined
                }
              />
            ))}

          {/* ── Playlists grid ─────────────────────────────────────── */}
          {tab === "playlists" && showPlaylists && (
            <div className="space-y-5">
              <Card className="p-5">
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
                    placeholder={t("learning.playlistPlaceholder")}
                    aria-label="New playlist name"
                    className="sm:flex-1"
                  />
                  <Button type="submit" icon={Plus} disabled={createPlaylist.isPending}>
                    {createPlaylist.isPending ? t("learning.creating") : t("learning.newPlaylist")}
                  </Button>
                </form>
              </Card>
              {visiblePlaylists.length > 0 ? (
                <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
                  {visiblePlaylists.map((pl) => (
                    <PathCard
                      key={pl.id}
                      p={pl}
                      detailTo={`/playlists/${pl.id}`}
                      continueTo={continueLink(pl, "/playlists")}
                    />
                  ))}
                </div>
              ) : (
                <EmptyState
                  icon={ListMusic}
                  title={playlists.length > 0 ? t("learning.noMatchTitle") : t("learning.noPlaylistsTitle")}
                  description={
                    playlists.length > 0
                      ? t("learning.noMatchDesc")
                      : t("learning.noPlaylistsDesc")
                  }
                />
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
}
