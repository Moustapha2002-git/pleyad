import { useEffect, useRef } from "react";

/**
 * Embedded YouTube via the official IFrame API, with real watch-progress
 * callbacks (percent watched, polled while playing; 100 on ended). The API
 * script is lazy-loaded once, only when a workspace actually shows a video.
 */

/* eslint-disable @typescript-eslint/no-explicit-any */
let apiPromise: Promise<any> | null = null;
function loadYouTubeApi(): Promise<any> {
  if (apiPromise) return apiPromise;
  apiPromise = new Promise((resolve) => {
    const w = window as any;
    if (w.YT?.Player) {
      resolve(w.YT);
      return;
    }
    const prev = w.onYouTubeIframeAPIReady;
    w.onYouTubeIframeAPIReady = () => {
      prev?.();
      resolve(w.YT);
    };
    const s = document.createElement("script");
    s.src = "https://www.youtube.com/iframe_api";
    document.head.appendChild(s);
  });
  return apiPromise;
}

export function YouTubePlayer({
  videoId,
  onProgress,
}: {
  videoId: string;
  /** Percent watched (0–100). Fired while playing (~10s cadence) and on end. */
  onProgress: (percent: number) => void;
}) {
  const hostRef = useRef<HTMLDivElement>(null);
  const cbRef = useRef(onProgress);
  cbRef.current = onProgress;

  useEffect(() => {
    let player: any;
    let timer: ReturnType<typeof setInterval> | undefined;
    let cancelled = false;

    loadYouTubeApi().then((YT) => {
      if (cancelled || !hostRef.current) return;
      player = new YT.Player(hostRef.current, {
        videoId,
        width: "100%",
        height: "100%",
        playerVars: { rel: 0, modestbranding: 1, playsinline: 1 },
        events: {
          onStateChange: (e: any) => {
            if (e.data === YT.PlayerState.ENDED) cbRef.current(100);
          },
        },
      });
      timer = setInterval(() => {
        try {
          if (player?.getPlayerState?.() !== 1) return; // only while playing
          const duration = player.getDuration?.();
          const t = player.getCurrentTime?.();
          if (duration > 0) cbRef.current(Math.min(99, Math.round((t / duration) * 100)));
        } catch {
          // player still booting — ignore
        }
      }, 10_000);
    });

    return () => {
      cancelled = true;
      if (timer) clearInterval(timer);
      try {
        player?.destroy?.();
      } catch {
        // already gone
      }
    };
  }, [videoId]);

  return (
    <div className="aspect-video w-full overflow-hidden rounded-2xl bg-black shadow-[var(--shadow-pop)]">
      <div ref={hostRef} className="h-full w-full" />
    </div>
  );
}
