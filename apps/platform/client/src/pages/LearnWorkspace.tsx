import { useRef, useState } from "react";
import { ArrowLeft, ChevronLeft, ChevronRight, ExternalLink } from "lucide-react";
import { Link, useLocation } from "wouter";
import { trpc } from "../lib/trpc";
import { useT } from "../lib/i18n";
import { Celebration } from "../components/Celebration";
import { useToast } from "../components/Toast";
import { YouTubePlayer } from "../components/YouTubePlayer";
import { platformTile, thumbnailFor, youtubeVideoId } from "../lib/thumbnails";
import { Button, Card, ProgressBar, Spinner, cn } from "../components/ui";

/**
 * The in-app learning workspace: player + lesson rail, SPA-navigated per lesson
 * (/…/:id/learn/:resourceId). YouTube plays embedded with auto-tracked progress;
 * non-embeddable platforms keep the workspace and open externally in a new tab.
 */
export default function LearnWorkspace({
  kind,
  id,
  resourceId,
}: {
  kind: "path" | "playlist";
  id: number;
  resourceId: number;
}) {
  const [, navigate] = useLocation();
  const { t } = useT();
  const toast = useToast();
  const utils = trpc.useUtils();

  const pathQ = trpc.paths.get.useQuery({ id }, { enabled: kind === "path" });
  const playlistQ = trpc.playlists.get.useQuery({ id }, { enabled: kind === "playlist" });
  const q = kind === "path" ? pathQ : playlistQ;

  const setPathProgress = trpc.paths.setItemProgress.useMutation();
  const setPlaylistProgress = trpc.playlists.setItemProgress.useMutation();
  const mutation = kind === "path" ? setPathProgress : setPlaylistProgress;

  const [celebrate, setCelebrate] = useState(false);
  // Highest percent already persisted this session, per resource — never regress.
  const savedRef = useRef<Map<number, number>>(new Map());
  const [liveProgress, setLiveProgress] = useState<number | null>(null);

  const base = kind === "path" ? "/paths" : "/playlists";

  if (q.isLoading) return <Spinner label={t("learnWorkspace.loading")} />;
  const p = q.data;
  if (!p) return <p className="text-ink/50">{t("learnWorkspace.notFound")}</p>;

  const items = p.items;
  const active = items.find((i) => i.resourceId === resourceId) ?? items[0];
  if (!active) {
    return (
      <Card className="p-6 text-ink/50">
        {kind === "path"
          ? t("learnWorkspace.noSkillsPath")
          : t("learnWorkspace.noSkillsPlaylist")}{" "}
        <Link to={`${base}/${id}`} className="font-medium text-navy underline">
          {t("learnWorkspace.back")}
        </Link>
      </Card>
    );
  }

  const idx = items.findIndex((i) => i.resourceId === active.resourceId);
  const prev = items[idx - 1];
  const next = items[idx + 1];
  const ytId = youtubeVideoId(active.url);
  const meta = platformTile(active.platform);
  const storedPct = Math.max(active.progress, savedRef.current.get(active.resourceId) ?? 0);
  const shownPct = Math.max(storedPct, liveProgress ?? 0);

  const goTo = (res: number) => {
    setLiveProgress(null);
    navigate(`${base}/${id}/learn/${res}`);
  };

  /** Persist progress — only ever upward; celebrate when the path completes. */
  const save = (pct: number) => {
    const current = Math.max(active.progress, savedRef.current.get(active.resourceId) ?? 0);
    if (pct <= current) return;
    savedRef.current.set(active.resourceId, pct);
    setLiveProgress(pct);
    const willComplete =
      pct >= 100 && !active.done && p.itemCount > 0 && p.completedCount + 1 === p.itemCount;
    mutation.mutate(
      { resourceId: active.resourceId, progress: pct },
      {
        onSuccess: () => {
          if (pct >= 100) {
            q.refetch();
            utils.paths.progression.invalidate();
            if (willComplete) setCelebrate(true);
            else toast.success(t("learnWorkspace.skillMastered"));
          }
        },
        onError: (e: { message: string }) => toast.error(e.message),
      },
    );
  };

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between gap-3">
        <Link
          to={`${base}/${id}`}
          className="inline-flex items-center gap-1 text-sm text-navy/60 transition hover:text-navy"
        >
          <ArrowLeft className="h-4 w-4" /> {p.title}
        </Link>
        <span className="text-sm text-ink/45">
          {t("learnWorkspace.lessonOf", { n: idx + 1, total: items.length })}
        </span>
      </div>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_300px]">
        {/* ── Player column ─────────────────────────────────────────── */}
        <div className="min-w-0 space-y-4">
          {ytId ? (
            <YouTubePlayer videoId={ytId} onProgress={save} />
          ) : (
            /* Non-embeddable platform: keep the workspace, open content externally */
            <div
              className={cn(
                "relative flex aspect-video w-full flex-col items-center justify-center overflow-hidden rounded-2xl bg-gradient-to-br text-white",
                meta.tile,
              )}
            >
              {thumbnailFor(active.url, active.thumbnailUrl) && (
                <img
                  src={thumbnailFor(active.url, active.thumbnailUrl)!}
                  alt=""
                  className="absolute inset-0 h-full w-full object-cover opacity-30"
                />
              )}
              <div className="relative px-8 text-center">
                <div className="text-xs font-bold uppercase tracking-[0.25em] text-white/70">
                  {meta.label}
                </div>
                <h2 className="mt-2 text-xl font-bold">{active.title}</h2>
                <p className="mx-auto mt-2 max-w-md text-sm text-white/70">
                  {t("learnWorkspace.opensExternal", { platform: meta.label })}
                </p>
                {active.url && (
                  <a
                    href={active.url}
                    target="_blank"
                    rel="noreferrer"
                    className="mt-5 inline-flex items-center gap-2 rounded-xl bg-white px-5 py-2.5 text-sm font-semibold text-navy-900 transition hover:bg-gray-100"
                  >
                    {t("learnWorkspace.openCourse")} <ExternalLink className="h-4 w-4" />
                  </a>
                )}
              </div>
            </div>
          )}

          {/* Lesson info + controls */}
          <Card className="p-5">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="min-w-0">
                <h1 className="text-lg font-bold text-navy-900">{active.title}</h1>
                <div className="mt-1 flex items-center gap-2 text-xs text-ink/50">
                  <span className="rounded-full bg-gray-100 px-2 py-0.5 font-medium">
                    {meta.label}
                  </span>
                  {ytId && <span>{t("learnWorkspace.tracksAuto")}</span>}
                </div>
              </div>
              <div className="flex gap-2">
                <Button
                  variant="secondary"
                  icon={ChevronLeft}
                  disabled={!prev}
                  onClick={() => prev && goTo(prev.resourceId)}
                >
                  {t("learnWorkspace.prev")}
                </Button>
                <Button
                  variant="secondary"
                  icon={ChevronRight}
                  disabled={!next}
                  onClick={() => next && goTo(next.resourceId)}
                >
                  {t("learnWorkspace.next")}
                </Button>
              </div>
            </div>

            <div className="mt-4 flex items-center gap-3">
              <ProgressBar
                value={shownPct}
                className="flex-1"
                barClassName={shownPct >= 100 ? "bg-emerald-500" : undefined}
              />
              <span className="w-12 text-right text-sm font-semibold text-navy-900">
                {shownPct}%
              </span>
              {shownPct < 100 && (
                <Button variant="secondary" onClick={() => save(100)}>
                  {t("learnWorkspace.markDone")}
                </Button>
              )}
            </div>
          </Card>
        </div>

        {/* ── Lesson rail ───────────────────────────────────────────── */}
        <aside className="space-y-2">
          <div className="flex items-baseline justify-between px-1">
            <h2 className="text-sm font-semibold text-navy-900">
              {kind === "path" ? t("learnWorkspace.railSkills") : t("learnWorkspace.railCourses")}
            </h2>
            <span className="text-xs text-ink/45">
              {p.completedCount}/{p.itemCount}
            </span>
          </div>
          {items.map((it, i) => {
            const isActive = it.resourceId === active.resourceId;
            const thumb = thumbnailFor(it.url, it.thumbnailUrl);
            const m = platformTile(it.platform);
            return (
              <button
                key={it.itemId}
                onClick={() => goTo(it.resourceId)}
                className={cn(
                  "flex w-full items-center gap-3 rounded-xl border bg-white p-2 text-left transition",
                  isActive
                    ? "border-navy-900 ring-1 ring-navy/20"
                    : "border-gray-200/70 hover:border-navy/40",
                )}
              >
                <span
                  className={cn(
                    "relative block h-12 w-20 shrink-0 overflow-hidden rounded-lg bg-gradient-to-br",
                    m.tile,
                  )}
                >
                  {thumb && <img src={thumb} alt="" className="h-full w-full object-cover" />}
                  <span className="absolute inset-x-0 bottom-0 h-0.5 bg-black/40">
                    <span
                      className={cn("block h-full", it.done ? "bg-emerald-400" : "bg-gold")}
                      style={{ width: `${it.progress}%` }}
                    />
                  </span>
                </span>
                <span className="min-w-0 flex-1">
                  <span
                    className={cn(
                      "line-clamp-2 text-xs font-medium leading-snug",
                      it.done ? "text-ink/40 line-through" : "text-navy-900",
                    )}
                  >
                    {i + 1}. {it.title}
                  </span>
                  <span
                    className={cn(
                      "mt-0.5 block text-[10px]",
                      it.done ? "text-emerald-600" : "text-ink/40",
                    )}
                  >
                    {it.done ? t("learnWorkspace.mastered") : `${it.progress}%`}
                  </span>
                </span>
              </button>
            );
          })}
        </aside>
      </div>

      {celebrate && (
        <Celebration
          title={
            kind === "path"
              ? t("learnWorkspace.celebrateTitlePath")
              : t("learnWorkspace.celebrateTitlePlaylist")
          }
          message={t("learnWorkspace.celebrateMsg", { title: p.title })}
          onClose={() => setCelebrate(false)}
        />
      )}
    </div>
  );
}
