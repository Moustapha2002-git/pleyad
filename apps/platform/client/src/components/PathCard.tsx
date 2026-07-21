import { CheckCircle2, ChevronRight, Play } from "lucide-react";
import { Link } from "wouter";
import { DimensionChip } from "./DimensionGauges";
import { platformTile, thumbnailFor } from "../lib/thumbnails";
import { useT } from "../lib/i18n";
import { ProgressBar, cn } from "./ui";

type T = (key: string, vars?: Record<string, string | number>) => string;

export type PathCardData = {
  id: number;
  title: string;
  progress: number;
  itemCount: number;
  completedCount: number;
  dimensions?: string[];
  dueAt?: string | Date | null;
  nextSkill?: { resourceId: number; title: string } | null;
  previewSkills?: { title: string; url: string | null; thumbnailUrl: string | null }[];
  lastActivityAt?: string | Date | null;
};

const daysUntil = (d: string | Date) =>
  Math.ceil((new Date(d).getTime() - Date.now()) / 86_400_000);

const lastActive = (d: string | Date | null | undefined, t: T) => {
  if (!d) return null;
  const days = Math.floor((Date.now() - new Date(d).getTime()) / 86_400_000);
  if (days <= 0) return t("pathCard.activeToday");
  if (days === 1) return t("pathCard.activeYesterday");
  return t("pathCard.activeDaysAgo", { n: days });
};

function status(p: PathCardData, t: T) {
  if (p.itemCount > 0 && p.progress >= 100)
    return { label: t("pathCard.completed"), cls: "bg-emerald-500 text-white" };
  if (p.dueAt && new Date(p.dueAt).getTime() < Date.now())
    return { label: t("pathCard.overdue"), cls: "bg-red-500 text-white" };
  if (p.progress > 0) return { label: t("pathCard.inProgress"), cls: "bg-gold text-navy-950" };
  return { label: t("pathCard.notStarted"), cls: "bg-white/90 text-navy-900" };
}

/** Cover strip built from the path's first skills (real YouTube thumbs when available). */
function Cover({ p }: { p: PathCardData }) {
  const { t } = useT();
  const skills = p.previewSkills ?? [];
  const s = status(p, t);
  return (
    <div className="relative flex h-28 w-full overflow-hidden">
      {skills.length > 0 ? (
        skills.map((sk, i) => {
          const thumb = thumbnailFor(sk.url, sk.thumbnailUrl);
          const tile = platformTile(null);
          return (
            <span
              key={i}
              className={cn(
                "relative block h-full flex-1 overflow-hidden bg-gradient-to-br",
                tile.tile,
              )}
            >
              {thumb ? (
                <img
                  src={thumb}
                  alt=""
                  loading="lazy"
                  className="h-full w-full object-cover transition duration-300 group-hover:scale-105"
                />
              ) : (
                <span className="flex h-full w-full items-center justify-center px-1 text-center text-[9px] font-semibold uppercase tracking-wide text-white/60">
                  {sk.title.slice(0, 20)}
                </span>
              )}
            </span>
          );
        })
      ) : (
        <span className="flex h-full w-full items-center justify-center bg-gradient-to-br from-navy-800 to-navy-950 text-xs font-semibold uppercase tracking-widest text-white/50">
          {t("learning.newPath")}
        </span>
      )}
      <span
        className={cn(
          "absolute left-2.5 top-2.5 rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide shadow-sm",
          s.cls,
        )}
      >
        {s.label}
      </span>
      {p.dueAt && p.progress < 100 && (
        <span
          className={cn(
            "absolute right-2.5 top-2.5 rounded-full px-2 py-0.5 text-[10px] font-bold shadow-sm",
            daysUntil(p.dueAt) < 0
              ? "bg-red-500 text-white"
              : daysUntil(p.dueAt) <= 3
                ? "bg-amber-400 text-navy-950"
                : "bg-black/50 text-white",
          )}
        >
          {daysUntil(p.dueAt) < 0
            ? t("pathCard.daysLate", { n: -daysUntil(p.dueAt) })
            : daysUntil(p.dueAt) === 0
              ? t("pathCard.dueToday")
              : t("pathCard.daysLeft", { n: daysUntil(p.dueAt) })}
        </span>
      )}
      {/* watched bar over the cover */}
      <span className="absolute inset-x-0 bottom-0 h-1 bg-black/40">
        <span
          className={cn(
            "block h-full transition-[width] duration-500",
            p.progress >= 100 ? "bg-emerald-400" : "bg-gold",
          )}
          style={{ width: `${p.progress}%` }}
        />
      </span>
    </div>
  );
}

/**
 * Premium path/playlist card: cover strip, status + due badges, next lesson and
 * a one-click Continue that deep-links straight into the learning workspace.
 */
export function PathCard({
  p,
  detailTo,
  continueTo,
}: {
  p: PathCardData;
  detailTo: string;
  continueTo: string | null;
}) {
  const { t } = useT();
  const done = p.itemCount > 0 && p.progress >= 100;
  return (
    <div className="group flex flex-col overflow-hidden rounded-2xl border border-gray-200/70 bg-white shadow-[var(--shadow-card)] transition hover:-translate-y-0.5 hover:shadow-[var(--shadow-pop)] focus-within:ring-2 focus-within:ring-navy/25">
      <Link to={detailTo} aria-label={p.title} className="focus:outline-none">
        <Cover p={p} />
      </Link>

      <div className="flex flex-1 flex-col gap-2 p-4">
        <Link to={detailTo} className="focus:outline-none">
          <h3 className="line-clamp-2 font-semibold leading-snug text-navy-900 transition group-hover:text-navy-700">
            {p.title}
          </h3>
        </Link>

        {(p.dimensions?.length ?? 0) > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {p.dimensions!.map((d) => (
              <DimensionChip key={d} dimension={d} />
            ))}
          </div>
        )}

        <div className="mt-1 flex items-center gap-2">
          <ProgressBar
            value={p.progress}
            className="flex-1"
            barClassName={done ? "bg-emerald-500" : undefined}
          />
          <span className="text-sm font-semibold text-navy-900">{p.progress}%</span>
        </div>
        <div className="text-xs text-ink/50">
          {t("pathCard.lessons", { done: p.completedCount, total: p.itemCount })}
          {lastActive(p.lastActivityAt, t) ? ` · ${lastActive(p.lastActivityAt, t)}` : ""}
        </div>

        <div className="mt-auto border-t border-gray-100 pt-3">
          {done ? (
            <Link
              to={detailTo}
              className="inline-flex w-full items-center justify-center gap-1.5 rounded-xl bg-emerald-500/10 px-3 py-2 text-sm font-semibold text-emerald-700 transition hover:bg-emerald-500/20"
            >
              <CheckCircle2 className="h-4 w-4" /> {t("pathCard.completedReview")}
            </Link>
          ) : continueTo ? (
            <Link
              to={continueTo}
              className="inline-flex w-full items-center justify-center gap-1.5 rounded-xl bg-navy-900 px-3 py-2 text-sm font-semibold text-white transition hover:bg-navy-800"
              aria-label={p.title}
            >
              <Play className="h-4 w-4" fill="currentColor" />
              <span className="truncate">
                {p.progress > 0 ? t("pathCard.continue") : t("pathCard.start")}
                {p.nextSkill ? `: ${p.nextSkill.title}` : ""}
              </span>
            </Link>
          ) : (
            <Link
              to={detailTo}
              className="inline-flex w-full items-center justify-center gap-1 rounded-xl border border-gray-200 px-3 py-2 text-sm font-medium text-navy/70 transition hover:bg-gray-50"
            >
              {t("pathCard.viewPath")} <ChevronRight className="h-4 w-4" />
            </Link>
          )}
        </div>
      </div>
    </div>
  );
}
