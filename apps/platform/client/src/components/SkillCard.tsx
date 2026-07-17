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
 * A skill/course inside a path — YouTube-style: thumbnail, title, platform,
 * a per-skill progress bar and a slider to self-report how far along you are.
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

  return (
    <div
      className={cn(
        "rounded-2xl border bg-white p-3 transition",
        item.done
          ? "border-emerald-200/70"
          : isNext
            ? "border-navy/30 ring-1 ring-navy/10"
            : "border-gray-200/70",
      )}
    >
      <div className="flex gap-3">
        {/* Thumbnail */}
        <a
          href={item.url ?? undefined}
          target="_blank"
          rel="noreferrer"
          className={cn(
            "group relative block h-[72px] w-32 shrink-0 overflow-hidden rounded-xl bg-gradient-to-br sm:h-[81px] sm:w-36",
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
            <span className="flex h-full w-full items-center justify-center text-xs font-bold uppercase tracking-wider text-white/90">
              {meta.label}
            </span>
          )}
          {item.url && (
            <span className="absolute inset-0 flex items-center justify-center bg-black/0 transition group-hover:bg-black/30">
              <Play className="h-6 w-6 text-white opacity-0 transition group-hover:opacity-100" />
            </span>
          )}
          {/* YouTube-style watched bar on the thumbnail */}
          <span className="absolute inset-x-0 bottom-0 h-1 bg-black/30">
            <span
              className={cn("block h-full", item.done ? "bg-emerald-400" : "bg-gold")}
              style={{ width: `${item.progress}%` }}
            />
          </span>
        </a>

        {/* Body */}
        <div className="flex min-w-0 flex-1 flex-col">
          <div className="flex items-start justify-between gap-2">
            <span
              className={cn(
                "line-clamp-2 text-sm font-semibold",
                item.done ? "text-ink/45 line-through" : "text-navy-900",
              )}
            >
              {item.title}
            </span>
            {item.done ? (
              <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-emerald-500 text-white">
                <Check className="h-3.5 w-3.5" />
              </span>
            ) : isNext ? (
              <span className="shrink-0 rounded-full bg-navy/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-navy/70">
                Next
              </span>
            ) : null}
          </div>

          <div className="mt-0.5 flex items-center gap-2 text-[11px] text-ink/45">
            <span className="rounded-full bg-gray-100 px-1.5 py-0.5">{meta.label}</span>
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
          <div className="mt-auto flex items-center gap-2 pt-1.5">
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
    </div>
  );
}
