import { useEffect, useRef, useState } from "react";
import { Play } from "lucide-react";
import { getVideoSignedUrl } from "@/lib/koth-utils";
import { cn } from "@/lib/utils";

type Props = {
  videoPath: string;
  onClick?: () => void;
  className?: string;
  /** Autoplay muted when on screen (TikTok grid behavior). */
  autoplayOnView?: boolean;
  badge?: React.ReactNode;
};

/**
 * 9:16 thumbnail tile for a submission video.
 * Loads the signed URL lazily, optionally autoplays muted on viewport.
 * Always shows a play affordance so users know it's interactive.
 */
export function VideoThumb({ videoPath, onClick, className, autoplayOnView, badge }: Props) {
  const [url, setUrl] = useState<string | null>(null);
  const ref = useRef<HTMLVideoElement | null>(null);
  const containerRef = useRef<HTMLButtonElement | null>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const io = new IntersectionObserver(
      (entries) => entries.forEach((e) => setVisible(e.isIntersecting)),
      { threshold: 0.2 },
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);

  useEffect(() => {
    if (!visible || url) return;
    let active = true;
    getVideoSignedUrl(videoPath).then((u) => {
      if (active) setUrl(u);
    });
    return () => {
      active = false;
    };
  }, [visible, url, videoPath]);

  useEffect(() => {
    const v = ref.current;
    if (!v || !autoplayOnView) return;
    if (visible) v.play().catch(() => {});
    else v.pause();
  }, [visible, autoplayOnView, url]);

  return (
    <button
      ref={containerRef}
      type="button"
      onClick={onClick}
      className={cn(
        "tap-44 group relative block aspect-[9/16] w-full overflow-hidden rounded-lg bg-neutral-900",
        className,
      )}
      aria-label="Play video"
    >
      {url ? (
        <video
          ref={ref}
          src={url}
          muted
          loop
          playsInline
          preload="metadata"
          className="h-full w-full object-cover"
        />
      ) : (
        <div className="h-full w-full animate-pulse bg-neutral-800" />
      )}
      <span className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/40 via-transparent to-transparent" />
      <span className="pointer-events-none absolute bottom-1.5 left-1.5 inline-flex items-center gap-1 text-[11px] font-bold text-white">
        <Play className="h-3 w-3" fill="currentColor" />
      </span>
      {badge && <span className="absolute right-1.5 top-1.5">{badge}</span>}
    </button>
  );
}
