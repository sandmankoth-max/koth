import { useEffect, useRef, useState } from "react";

type Props = {
  videoRef: React.RefObject<HTMLVideoElement | null>;
  className?: string;
};

function fmt(t: number) {
  if (!Number.isFinite(t) || t < 0) t = 0;
  const m = Math.floor(t / 60);
  const s = Math.floor(t % 60);
  return `${m}:${String(s).padStart(2, "0")}`;
}

/**
 * TikTok-style draggable progress bar.
 * - Thin line at rest, plumps up while dragging
 * - Shows current / total timestamp overlay during drag
 * - Pauses on drag, resumes on release
 */
export function VideoScrubber({ videoRef, className }: Props) {
  const trackRef = useRef<HTMLDivElement>(null);
  const [progress, setProgress] = useState(0); // 0..1
  const [duration, setDuration] = useState(0);
  const [dragging, setDragging] = useState(false);
  const [dragTime, setDragTime] = useState(0);
  const wasPlayingRef = useRef(false);

  useEffect(() => {
    const v = videoRef.current;
    if (!v) return;
    const onTime = () => {
      if (dragging) return;
      const d = v.duration || 0;
      setDuration(d);
      setProgress(d ? v.currentTime / d : 0);
    };
    const onMeta = () => setDuration(v.duration || 0);
    v.addEventListener("timeupdate", onTime);
    v.addEventListener("loadedmetadata", onMeta);
    v.addEventListener("durationchange", onMeta);
    return () => {
      v.removeEventListener("timeupdate", onTime);
      v.removeEventListener("loadedmetadata", onMeta);
      v.removeEventListener("durationchange", onMeta);
    };
  }, [videoRef, dragging]);

  function ratioFromClient(clientX: number) {
    const el = trackRef.current;
    if (!el) return 0;
    const r = el.getBoundingClientRect();
    return Math.min(1, Math.max(0, (clientX - r.left) / r.width));
  }

  function startDrag(clientX: number) {
    const v = videoRef.current;
    if (!v) return;
    wasPlayingRef.current = !v.paused;
    if (!v.paused) v.pause();
    setDragging(true);
    const ratio = ratioFromClient(clientX);
    const d = v.duration || duration || 0;
    setProgress(ratio);
    setDragTime(ratio * d);
  }
  function moveDrag(clientX: number) {
    const v = videoRef.current;
    if (!v) return;
    const ratio = ratioFromClient(clientX);
    const d = v.duration || duration || 0;
    setProgress(ratio);
    setDragTime(ratio * d);
  }
  function endDrag() {
    const v = videoRef.current;
    if (!v) {
      setDragging(false);
      return;
    }
    const d = v.duration || duration || 0;
    v.currentTime = progress * d;
    setDragging(false);
    if (wasPlayingRef.current) v.play().catch(() => {});
  }

  useEffect(() => {
    if (!dragging) return;
    const onMove = (e: MouseEvent) => moveDrag(e.clientX);
    const onUp = () => endDrag();
    const onTouchMove = (e: TouchEvent) => {
      if (e.touches[0]) moveDrag(e.touches[0].clientX);
    };
    const onTouchEnd = () => endDrag();
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
    window.addEventListener("touchmove", onTouchMove, { passive: true });
    window.addEventListener("touchend", onTouchEnd);
    return () => {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
      window.removeEventListener("touchmove", onTouchMove);
      window.removeEventListener("touchend", onTouchEnd);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dragging, progress, duration]);

  const pct = Math.min(100, Math.max(0, progress * 100));
  const trackH = dragging ? "h-1.5" : "h-[3px]";
  const dotSize = dragging ? 14 : 10;

  return (
    <div className={`pointer-events-auto select-none ${className ?? ""}`}>
      {dragging && (
        <div className="mb-1 flex justify-center">
          <span className="mono-stat rounded-full bg-black/60 px-2 py-0.5 text-[11px] font-bold text-white backdrop-blur">
            {fmt(dragTime)} / {fmt(duration)}
          </span>
        </div>
      )}
      <div
        ref={trackRef}
        onMouseDown={(e) => {
          e.stopPropagation();
          startDrag(e.clientX);
        }}
        onTouchStart={(e) => {
          e.stopPropagation();
          if (e.touches[0]) startDrag(e.touches[0].clientX);
        }}
        className={`relative w-full cursor-pointer rounded-full bg-white/30 ${trackH} transition-all`}
      >
        <div
          className="absolute inset-y-0 left-0 rounded-full bg-white"
          style={{ width: `${pct}%` }}
        />
        <div
          className="absolute top-1/2 rounded-full bg-white shadow"
          style={{
            left: `${pct}%`,
            width: dotSize,
            height: dotSize,
            transform: "translate(-50%, -50%)",
            transition: dragging ? "none" : "width 120ms, height 120ms",
          }}
        />
      </div>
    </div>
  );
}
