/**
 * Skill-card thumbnails. YouTube URLs yield real thumbnails (derivable from the
 * video id, no API key). Other platforms get a branded gradient tile until a
 * metadata fetcher lands.
 */

export function youtubeVideoId(url: string | null | undefined): string | null {
  if (!url) return null;
  const m =
    /(?:youtube\.com\/(?:watch\?(?:.*&)?v=|embed\/|shorts\/)|youtu\.be\/)([\w-]{11})/.exec(url);
  return m?.[1] ?? null;
}

/** Real thumbnail URL when derivable (YouTube), else null → use a platform tile. */
export function thumbnailFor(
  url: string | null | undefined,
  stored: string | null | undefined,
): string | null {
  if (stored) return stored;
  const id = youtubeVideoId(url);
  return id ? `https://i.ytimg.com/vi/${id}/mqdefault.jpg` : null;
}

const TILES = {
  youtube: { label: "YouTube", tile: "from-red-500/80 to-red-700/90" },
  coursera: { label: "Coursera", tile: "from-blue-500/80 to-blue-800/90" },
  udemy: { label: "Udemy", tile: "from-violet-500/80 to-violet-800/90" },
  edx: { label: "edX", tile: "from-indigo-500/80 to-indigo-800/90" },
  linkedin: { label: "LinkedIn", tile: "from-sky-600/80 to-sky-900/90" },
  other: { label: "Course", tile: "from-navy-700 to-navy-950" },
} satisfies Record<string, { label: string; tile: string }>;

export function platformTile(platform: string | null | undefined) {
  return TILES[(platform ?? "other") as keyof typeof TILES] ?? TILES.other;
}
