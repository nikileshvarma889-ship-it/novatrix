"use client";
import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from "react";
import { ExternalLink, ShieldAlert } from "lucide-react";

/* Minimal types for the official YouTube IFrame Player API. */
type YTPlayer = { getCurrentTime: () => number; getDuration: () => number; seekTo: (s: number, allow: boolean) => void; pauseVideo: () => void; playVideo: () => void; destroy: () => void; getPlayerState: () => number };
type YTNamespace = { Player: new (el: HTMLElement, opts: unknown) => YTPlayer; PlayerState: { ENDED: number; PLAYING: number; PAUSED: number } };
declare global { interface Window { YT?: YTNamespace; onYouTubeIframeAPIReady?: () => void } }

let apiPromise: Promise<YTNamespace> | null = null;
function loadApi() {
  if (apiPromise) return apiPromise;
  apiPromise = new Promise((resolve) => {
    if (window.YT?.Player) return resolve(window.YT);
    const prev = window.onYouTubeIframeAPIReady;
    window.onYouTubeIframeAPIReady = () => { prev?.(); resolve(window.YT!); };
    const s = document.createElement("script");
    s.src = "https://www.youtube.com/iframe_api";
    s.async = true;
    document.head.appendChild(s);
  });
  return apiPromise;
}

export type PlayerHandle = { time: () => number; seek: (s: number) => void; duration: () => number };

/**
 * In-app playback through the official IFrame Player API. If the creator has disabled embedding (errors 101/150)
 * or the video is unavailable, we show a clear message and an optional link to watch on YouTube — never a workaround.
 */
export const YouTubePlayer = forwardRef<PlayerHandle, { videoId: string; start?: number; onProgress?: (t: number, d: number) => void; onEnded?: () => void }>(function YouTubePlayer({ videoId, start = 0, onProgress, onEnded }, ref) {
  const host = useRef<HTMLDivElement>(null);
  const player = useRef<YTPlayer | null>(null);
  const [err, setErr] = useState<number | null>(null);
  const cb = useRef({ onProgress, onEnded });
  cb.current = { onProgress, onEnded };

  useImperativeHandle(ref, () => ({
    time: () => player.current?.getCurrentTime?.() ?? 0,
    duration: () => player.current?.getDuration?.() ?? 0,
    seek: (s) => { player.current?.seekTo(s, true); player.current?.playVideo(); },
  }));

  useEffect(() => {
    let disposed = false;
    let tick: ReturnType<typeof setInterval> | null = null;
    setErr(null);
    loadApi().then((YT) => {
      if (disposed || !host.current) return;
      const el = document.createElement("div");
      host.current.innerHTML = "";
      host.current.appendChild(el);
      player.current = new YT.Player(el, {
        videoId, width: "100%", height: "100%",
        playerVars: { rel: 0, modestbranding: 1, playsinline: 1, start: Math.floor(start), origin: window.location.origin },
        events: {
          onError: (e: { data: number }) => setErr(e.data),
          onStateChange: (e: { data: number }) => {
            if (e.data === YT.PlayerState.ENDED) cb.current.onEnded?.();
            if (e.data === YT.PlayerState.PAUSED) cb.current.onProgress?.(player.current!.getCurrentTime(), player.current!.getDuration());
          },
        },
      });
      tick = setInterval(() => {
        const p = player.current;
        if (p?.getPlayerState?.() === YT.PlayerState.PLAYING) cb.current.onProgress?.(p.getCurrentTime(), p.getDuration());
      }, 10000);
    });
    return () => {
      disposed = true;
      if (tick) clearInterval(tick);
      try {
        const p = player.current;
        if (p?.getCurrentTime) cb.current.onProgress?.(p.getCurrentTime(), p.getDuration());
        p?.destroy();
      } catch { /* player already gone */ }
      player.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [videoId]);

  return (
    <div className="relative aspect-video w-full overflow-hidden rounded-2xl bg-black">
      <div ref={host} className="absolute inset-0 [&>iframe]:h-full [&>iframe]:w-full" />
      {err !== null && (
        <div className="absolute inset-0 grid place-items-center bg-black/90 p-6 text-center text-white">
          <div className="max-w-sm">
            <ShieldAlert className="mx-auto h-10 w-10 text-amber-400" />
            <h3 className="mt-3 font-semibold">{err === 101 || err === 150 ? "This video can't be played inside MEMORA" : err === 100 ? "This video is unavailable" : "The video couldn't be loaded"}</h3>
            <p className="mt-1.5 text-sm text-white/70">{err === 101 || err === 150 ? "The creator has turned off playback on other websites. You can still watch it on YouTube if you like." : "It may have been removed or made private."}</p>
            {err !== 100 && <a href={`https://www.youtube.com/watch?v=${videoId}`} target="_blank" rel="noopener noreferrer" className="mt-4 inline-flex items-center gap-2 rounded-xl bg-white/10 px-4 py-2 text-sm hover:bg-white/20"><ExternalLink className="h-4 w-4" />Open on YouTube</a>}
          </div>
        </div>
      )}
    </div>
  );
});
