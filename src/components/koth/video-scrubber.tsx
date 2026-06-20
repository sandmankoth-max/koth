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
 * Smooth TikTok-style draggable scrubber.
 * - rAF-driven progress so it moves continuously, not on `timeupdate` ticks.
 * - Generous invisible hit area (24px tall) over a 2px visible track.
 * - Plumps + shows time overlay while dragging.
 */
export function VideoScrubber({ videoRef, className }: Props) {
  const trackRef = useRef<HTMLDivElement>(null);
  const [progress, setProgress] = useState(0);
  const [duration, setDuration] = useState(0);
  const [dragging, setDragging] = useState(false);
  const [dragTime, setDragTime] = useState(0);
  const draggingRef = useRef(false);
  const wasPlayingRef = useRef(false);

  // rAF loop for smooth progress.
  useEffect(() => {
    let raf = 0;
    const tick = () => {
      const v = videoRef.current;
      if (v && !draggingRef.current) {
        const d = v.duration || 0;
        if (d !== duration) setDuration(d);
        setProgress(d ? v.currentTime / d : 0);
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [videoRef]);

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
    draggingRef.current = true;
    setDragging(true);
    const ratio = ratioFromClient(clientX);
    const d = v.duration || duration || 0;
    setProgress(ratio);
    setDragTime(ratio * d);
    // Seek live so the preview frame updates while dragging.
    try { v.currentTime = ratio * d; } catch {}
  }
  function moveDrag(clientX: number) {
    const v = videoRef.current;
    if (!v) return;
    const ratio = ratioFromClient(clientX);
    const d = v.duration || duration || 0;
    setProgress(ratio);
    setDragTime(ratio * d);
    try { v.currentTime = ratio * d; } catch {}
  }
  function endDrag() {
    const v = videoRef.current;
    draggingRef.current = false;
    setDragging(false);
    if (!v) return;
    if (wasPlayingRef.current) v.play().catch(() => {});
  }

  useEffect(() => {
    if (!dragging) return;
    const onMove = (e: MouseEvent) => moveDrag(e.clientX);
    const onUp = () => endDrag();
    const onTouchMove = (e: TouchEvent) => { if (e.touches[0]) moveDrag(e.touches[0].clientX); };
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
  }, [dragging]);

  const pct = Math.min(100, Math.max(0, progress * 100));
  const trackH = dragging ? 6 : 2;
  const dotSize = dragging ? 14 : 0;

  return (
    <div className={`pointer-events-auto select-none ${className ?? ""}`}>
      {dragging && (
        <div className="mb-1 flex justify-center">
          <span className="mono-stat rounded-full bg-black/70 px-2.5 py-0.5 text-[11px] font-bold text-white backdrop-blur">
            {fmt(dragTime)} / {fmt(duration)}
          </span>
        </div>
      )}
      {/* Tall transparent hit target so the thin bar is easy to grab */}
      <div
        ref={trackRef}
        onMouseDown={(e) => { e.stopPropagation(); startDrag(e.clientX); }}
        onTouchStart={(e) => { e.stopPropagation(); if (e.touches[0]) startDrag(e.touches[0].clientX); }}
        className="relative flex w-full cursor-pointer items-center"
        style={{ height: 24 }}
      >
        <div
          className="relative w-full rounded-full bg-white/30 transition-[height] duration-150"
          style={{ height: trackH }}
        >
          <div
            className="absolute inset-y-0 left-0 rounded-full bg-white"
            style={{ width: `${pct}%` }}
          />
          {dragging && (
            <div
              className="absolute top-1/2 rounded-full bg-white shadow"
              style={{
                left: `${pct}%`,
                width: dotSize,
                height: dotSize,
                transform: "translate(-50%, -50%)",
              }}
            />
          )}
        </div>
      </div>
    </div>
  );
}
