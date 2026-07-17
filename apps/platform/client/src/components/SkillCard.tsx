import { useEffect, useState } from "react";
import { Check, ExternalLink, Play } from "lucide-react";
import { platformTile, thumbnailFor } from "../lib/thumbnails";
import { cn } from "./ui";

export type SkillItem = {
  itemId: number;
  resourceId: number;
  title: string;
  platform: string | null;
  url: string | null;
  thumbnailUrl?: string | null;
  progress: number; // 0–100
  done: boolean;
};

/**
 * A skill/course inside a path — YouTube-grid style card: big thumbnail with a
 * watched-bar, then the skill's info and a slider to self-report progress.
 */
export function SkillCard({
  item,
  isNext,
  onProgress,
}: {
  item: SkillItem;
  isNext: boolean;
  onProgress: (progress: number) => void;
}) {
  // Local value while dragging; commits on release.
  const [value, setValue] = useState(item.progress);
  useEffect(() => setValue(item.progress), [item.progress]);

  const thumb = thumbnailFor(item.url, item.thumbnailUrl);
  const meta = platformTile(item.platform);
  const statusLabel = item.done
    ? "Mastered"
    : item.progress > 0
      ? "In progress"
      : isNext
        ? "Up next"
        : "Not started";

  return (
    <div
      className={cn(
        "flex flex-col overflow-hidden rounded-2xl border bg-white shadow-[var(--shadow-card)] transition hover:-translate-y-0.5 hover:shadow-[var(--shadow-pop)]",
        item.done
          ? "border-emerald-200/70"
          : isNext
            ? "border-navy/30 ring-1 ring-navy/10"
            : "border-gray-200/70",
      )}
    >
      {/* Thumbnail */}
      <a
        href={item.url ?? undefined}
        target="_blank"
        rel="noreferrer"
        className={cn(
          "group relative block aspect-video w-full overflow-hidden bg-gradient-to-br",
          meta.tile,
        )}
      >
        {thumb ? (
          <img
            src={thumb}
            alt=""
            loading="lazy"
            className="h-full w-full object-cover transition group-hover:scale-105"
          />
        ) : (
          <span className="flex h-full w-full items-center justify-center text-sm font-bold uppercase tracking-[0.2em] text-white/90">
            {meta.label}
          </span>
        )}
        {item.url && (
          <span className="absolute inset-0 flex items-center justify-center bg-black/0 transition group-hover:bg-black/30">
            <span className="flex h-11 w-11 items-center justify-center rounded-full bg-black/60 opacity-0 transition group-hover:opacity-100">
              <Play className="h-5 w-5 text-white" fill="white" />
            </span>
          </span>
        )}
        {/* Status badge on the thumbnail */}
        <span
          className={cn(
            "absolute left-2 top-2 rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide",
            item.done
              ? "bg-emerald-500 text-white"
              : isNext
                ? "bg-white/90 text-navy-900"
                : "bg-black/50 text-white/90",
          )}
        >
          {statusLabel}
        </span>
        {item.done && (
          <span className="absolute right-2 top-2 flex h-6 w-6 items-center justify-center rounded-full bg-emerald-500 text-white">
            <Check className="h-4 w-4" />
          </span>
        )}
        {/* YouTube-style watched bar */}
        <span className="absolute inset-x-0 bottom-0 h-1 bg-black/40">
          <span
            className={cn("block h-full", item.done ? "bg-emerald-400" : "bg-gold")}
            style={{ width: `${item.progress}%` }}
          />
        </span>
      </a>

      {/* Info */}
      <div className="flex flex-1 flex-col gap-2 p-4">
        <span
          className={cn(
            "line-clamp-2 text-sm font-semibold leading-snug",
            item.done ? "text-ink/45 line-through" : "text-navy-900",
          )}
        >
          {item.title}
        </span>

        <div className="flex items-center gap-2 text-[11px] text-ink/45">
          <span className="rounded-full bg-gray-100 px-2 py-0.5 font-medium">{meta.label}</span>
          {item.url && (
            <a
              href={item.url}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-0.5 font-medium text-navy/60 transition hover:text-navy"
            >
              Open <ExternalLink className="h-3 w-3" />
            </a>
          )}
        </div>

        {/* Per-skill progress */}
        <div className="mt-auto flex items-center gap-2 pt-1">
          <input
            type="range"
            min={0}
            max={100}
            step={25}
            value={value}
            onChange={(e) => setValue(Number(e.target.value))}
            onMouseUp={() => value !== item.progress && onProgress(value)}
            onTouchEnd={() => value !== item.progress && onProgress(value)}
            onKeyUp={() => value !== item.progress && onProgress(value)}
            aria-label={`Progress on ${item.title}`}
            className="h-1.5 flex-1 cursor-pointer appearance-none rounded-full bg-gray-200 accent-[#0a2540]"
          />
          <span
            className={cn(
              "w-10 text-right text-xs font-semibold",
              item.done ? "text-emerald-600" : "text-navy-900",
            )}
          >
            {value}%
          </span>
        </div>
      </div>
    </div>
  );
}
