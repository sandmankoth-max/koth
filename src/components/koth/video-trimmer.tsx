/**
 * iPhone Photos style non-destructive video trimmer.
 *
 * - A filmstrip of extracted frames represents the full clip.
 * - Two yellow handles set the in/out points; the selection is highlighted and
 *   the excluded parts dim, exactly like the iOS camera roll trim UI.
 * - Trim values are only metadata (`start`/`end` seconds). The original blob is
 *   never modified, so reopening the trimmer lets the user widen the range or
 *   reset it entirely. The actual cut happens once, right before upload.
 */
import { useCallback, useEffect, useRef, useState } from "react";

const MIN_DURATION = 1; // seconds

export type TrimRange = { start: number; end: number };

function fmt(t: number) {
  if (!Number.isFinite(t) || t < 0) t = 0;
  const m = Math.floor(t / 60);
  const s = Math.floor(t % 60);
  return `${m}:${String(s).padStart(2, "0")}`;
}

export function VideoTrimmer({
  src,
  duration,
  value,
  onCancel,
  onSave,
}: {
  src: string;
  duration: number;
  value: TrimRange | null;
  onCancel: () => void;
  onSave: (r: TrimRange | null) => void;
}) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const stripRef = useRef<HTMLDivElement>(null);
  const [dur, setDur] = useState(duration || 0);
  const [start, setStart] = useState(value?.start ?? 0);
  const [end, setEnd] = useState(value?.end ?? duration ?? 0);
  const [frames, setFrames] = useState<string[]>([]);
  const [drag, setDrag] = useState<"start" | "end" | null>(null);
  const dragRef = useRef<"start" | "end" | null>(null);

  // Read real duration once metadata lands (blob durations are often unknown).
  const onMeta = useCallback(() => {
    const v = videoRef.current;
    if (!v) return;
    const d = Number.isFinite(v.duration) && v.duration > 0 ? v.duration : dur;
    setDur(d);
    if (!value) {
      setStart(0);
      setEnd(d);
    } else {
      setEnd(Math.min(value.end || d, d));
    }
  }, [dur, value]);

  // Extract ~8 filmstrip thumbnails from the source clip.
  useEffect(() => {
    let cancelled = false;
    const v = document.createElement("video");
    v.src = src;
    v.muted = true;
    v.playsInline = true;
    const canvas = document.createElement("canvas");
    const shots: string[] = [];
    const COUNT = 8;

    const grab = (i: number) => {
      if (cancelled || i >= COUNT) {
        if (!cancelled) setFrames([...shots]);
        return;
      }
      const d = Number.isFinite(v.duration) && v.duration > 0 ? v.duration : 1;
      const t = (d * (i + 0.5)) / COUNT;
      const onSeeked = () => {
        v.removeEventListener("seeked", onSeeked);
        try {
          canvas.width = 90;
          canvas.height = 160;
          const ctx = canvas.getContext("2d");
          ctx?.drawImage(v, 0, 0, canvas.width, canvas.height);
          shots.push(canvas.toDataURL("image/jpeg", 0.6));
          if (!cancelled) setFrames([...shots]);
        } catch {
          // Frame grab can fail on some platforms; the strip just stays sparse.
        }
        grab(i + 1);
      };
      v.addEventListener("seeked", onSeeked);
      try {
        v.currentTime = t;
      } catch {
        grab(i + 1);
      }
    };

    const onLoaded = () => grab(0);
    v.addEventListener("loadeddata", onLoaded, { once: true });
    return () => {
      cancelled = true;
      v.removeEventListener("loadeddata", onLoaded);
      v.src = "";
    };
  }, [src]);

  // Keep playback inside the selected range, iOS style.
  useEffect(() => {
    const v = videoRef.current;
    if (!v) return;
    const onTime = () => {
      if (v.currentTime >= end - 0.03) {
        v.currentTime = start;
        v.play().catch(() => {});
      } else if (v.currentTime < start - 0.05) {
        v.currentTime = start;
      }
    };
    v.addEventListener("timeupdate", onTime);
    return () => v.removeEventListener("timeupdate", onTime);
  }, [start, end]);

  const ratioFromClient = (clientX: number) => {
    const el = stripRef.current;
    if (!el) return 0;
    const r = el.getBoundingClientRect();
    return Math.min(1, Math.max(0, (clientX - r.left) / r.width));
  };

  const move = useCallback(
    (clientX: number) => {
      const which = dragRef.current;
      if (!which || !dur) return;
      const t = ratioFromClient(clientX) * dur;
      const v = videoRef.current;
      if (which === "start") {
        const next = Math.min(t, end - MIN_DURATION);
        setStart(Math.max(0, next));
        if (v) try { v.currentTime = Math.max(0, next); } catch { /* seek race */ }
      } else {
        const next = Math.max(t, start + MIN_DURATION);
        setEnd(Math.min(dur, next));
        if (v) try { v.currentTime = Math.min(dur, next) - 0.05; } catch { /* seek race */ }
      }
    },
    [dur, end, start],
  );

  useEffect(() => {
    if (!drag) return;
    const onMove = (e: MouseEvent) => move(e.clientX);
    const onTouch = (e: TouchEvent) => { if (e.touches[0]) move(e.touches[0].clientX); };
    const onUp = () => { dragRef.current = null; setDrag(null); videoRef.current?.play().catch(() => {}); };
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
    window.addEventListener("touchmove", onTouch, { passive: true });
    window.addEventListener("touchend", onUp);
    return () => {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
      window.removeEventListener("touchmove", onTouch);
      window.removeEventListener("touchend", onUp);
    };
  }, [drag, move]);

  const pct = (t: number) => (dur ? Math.min(100, Math.max(0, (t / dur) * 100)) : 0);
  const untouched = start <= 0.05 && end >= dur - 0.05;

  return (
    <div className="space-y-3">
      <video
        ref={videoRef}
        src={src}
        playsInline
        autoPlay
        loop={false}
        muted={false}
        onLoadedMetadata={onMeta}
        className="aspect-[9/16] w-full rounded-3xl bg-black object-cover"
      />

      <div className="rounded-2xl border border-border bg-card p-3">
        <div className="mb-2 flex items-center justify-between text-[11px] text-muted-foreground">
          <span className="mono-stat">{fmt(start)}</span>
          <span className="mono-stat font-bold text-foreground">{fmt(end - start)} selected</span>
          <span className="mono-stat">{fmt(end)}</span>
        </div>

        <div ref={stripRef} className="relative h-16 w-full select-none overflow-hidden rounded-xl bg-black">
          <div className="absolute inset-0 flex">
            {(frames.length ? frames : Array.from({ length: 8 })).map((f, i) => (
              <div key={i} className="h-full flex-1 bg-muted/30">
                {typeof f === "string" && (
                  <img src={f} alt="" className="h-full w-full object-cover" draggable={false} />
                )}
              </div>
            ))}
          </div>

          {/* Dimmed regions outside the selection */}
          <div className="absolute inset-y-0 left-0 bg-black/60" style={{ width: `${pct(start)}%` }} />
          <div className="absolute inset-y-0 right-0 bg-black/60" style={{ width: `${100 - pct(end)}%` }} />

          {/* Selection frame */}
          <div
            className="pointer-events-none absolute inset-y-0 border-y-[3px] border-koth-red"
            style={{ left: `${pct(start)}%`, right: `${100 - pct(end)}%` }}
          />

          {/* Handles */}
          <button
            onMouseDown={(e) => { e.preventDefault(); dragRef.current = "start"; setDrag("start"); videoRef.current?.pause(); }}
            onTouchStart={() => { dragRef.current = "start"; setDrag("start"); videoRef.current?.pause(); }}
            aria-label="Trim start"
            className="absolute inset-y-0 flex w-6 items-center justify-center rounded-l-lg bg-koth-red"
            style={{ left: `calc(${pct(start)}% - 0px)` }}
          >
            <span className="h-6 w-[3px] rounded-full bg-koth-white" />
          </button>
          <button
            onMouseDown={(e) => { e.preventDefault(); dragRef.current = "end"; setDrag("end"); videoRef.current?.pause(); }}
            onTouchStart={() => { dragRef.current = "end"; setDrag("end"); videoRef.current?.pause(); }}
            aria-label="Trim end"
            className="absolute inset-y-0 flex w-6 items-center justify-center rounded-r-lg bg-koth-red"
            style={{ left: `calc(${pct(end)}% - 24px)` }}
          >
            <span className="h-6 w-[3px] rounded-full bg-koth-white" />
          </button>
        </div>

        <p className="mt-2 text-center text-[11px] text-muted-foreground">
          Drag the ends to trim. Nothing is deleted until you submit, so you can
          always come back and widen it again.
        </p>
      </div>

      <div className="grid grid-cols-3 gap-2">
        <button
          onClick={onCancel}
          className="tap-44 h-12 rounded-full border border-border text-sm font-bold text-foreground"
        >
          Cancel
        </button>
        <button
          onClick={() => { setStart(0); setEnd(dur); }}
          disabled={untouched}
          className="tap-44 h-12 rounded-full border border-border text-sm font-bold text-muted-foreground disabled:opacity-50"
        >
          Reset
        </button>
        <button
          onClick={() => onSave(untouched ? null : { start, end })}
          className="tap-44 h-12 rounded-full bg-koth-red text-sm font-bold text-koth-white"
        >
          Save
        </button>
      </div>
    </div>
  );
}
