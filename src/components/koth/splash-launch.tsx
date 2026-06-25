import { useEffect, useLayoutEffect, useRef, useState } from "react";

/**
 * KOTH animated splash that mirrors the static iOS LaunchScreen, then plays:
 *   1. Holds the launch screen exactly (KING. OF. THE. HILL. centered, byline bottom).
 *   2. The two "I" letters pop and morph into stick figures.
 *   3. Left figure runs right across N G . O F; right figure runs left across H . E H T.
 *   4. They jump toward the top-center to clash. Camera comic-zooms in.
 *   5. Throw / dodge / block exchange.
 *   6. Left figure wins; right figure is knocked out; left sprints off-screen right.
 *
 * Total runtime ≈ 7s, then `onDone` fires and the overlay fades out.
 */
type Phase =
  | "intro"
  | "pop"
  | "morph"
  | "run"
  | "jump"
  | "fight1"
  | "fight2"
  | "fight3"
  | "knockout"
  | "exit"
  | "fade"
  | "done";

type Pt = { x: number; y: number };

const CHARS = "KING. OF. THE. HILL.".split("");
// Index map: 0K 1I 2N 3G 4. 5  6O 7F 8. 9  10T 11H 12E 13. 14  15H 16I 17L 18L 19.
const LEFT_I = 1;
const RIGHT_I = 16;
const LEFT_TARGET = 7; // F
const RIGHT_TARGET = 10; // T

export function SplashLaunch({ onDone }: { onDone: () => void }) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const titleRef = useRef<HTMLHeadingElement>(null);
  const letterRefs = useRef<(HTMLSpanElement | null)[]>([]);
  const [pts, setPts] = useState<Pt[] | null>(null);
  const [phase, setPhase] = useState<Phase>("intro");

  useLayoutEffect(() => {
    const wrap = wrapRef.current;
    if (!wrap) return;
    const wrapRect = wrap.getBoundingClientRect();
    const next: Pt[] = letterRefs.current.map((el) => {
      if (!el) return { x: 0, y: 0 };
      const r = el.getBoundingClientRect();
      return {
        x: r.left - wrapRect.left + r.width / 2,
        y: r.top - wrapRect.top + r.height / 2,
      };
    });
    setPts(next);
  }, []);

  useEffect(() => {
    if (!pts) return;
    const timers: ReturnType<typeof setTimeout>[] = [];
    const seq: [Phase, number][] = [
      ["pop", 700],
      ["morph", 1150],
      ["run", 1500],
      ["jump", 3000],
      ["fight1", 3700],
      ["fight2", 4200],
      ["fight3", 4700],
      ["knockout", 5200],
      ["exit", 5800],
      ["fade", 6700],
      ["done", 7300],
    ];
    for (const [p, t] of seq) {
      timers.push(setTimeout(() => setPhase(p), t));
    }
    return () => timers.forEach(clearTimeout);
  }, [pts]);

  useEffect(() => {
    if (phase === "done") onDone();
  }, [phase, onDone]);

  // Compute positions per phase
  const leftPos = (): Pt => {
    if (!pts) return { x: 0, y: 0 };
    if (phase === "intro" || phase === "pop" || phase === "morph") return pts[LEFT_I];
    if (phase === "run") return { x: pts[LEFT_TARGET].x, y: pts[LEFT_I].y };
    if (phase === "jump" || phase === "fight1" || phase === "fight2" || phase === "fight3")
      return { x: (pts[LEFT_TARGET].x + pts[RIGHT_TARGET].x) / 2 - 28, y: pts[LEFT_I].y - 160 };
    if (phase === "knockout")
      return { x: (pts[LEFT_TARGET].x + pts[RIGHT_TARGET].x) / 2 - 28, y: pts[LEFT_I].y - 140 };
    if (phase === "exit" || phase === "fade" || phase === "done")
      return { x: (wrapRef.current?.clientWidth ?? 800) + 80, y: pts[LEFT_I].y };
    return pts[LEFT_I];
  };

  const rightPos = (): Pt => {
    if (!pts) return { x: 0, y: 0 };
    if (phase === "intro" || phase === "pop" || phase === "morph") return pts[RIGHT_I];
    if (phase === "run") return { x: pts[RIGHT_TARGET].x, y: pts[RIGHT_I].y };
    if (phase === "jump" || phase === "fight1" || phase === "fight2" || phase === "fight3")
      return { x: (pts[LEFT_TARGET].x + pts[RIGHT_TARGET].x) / 2 + 28, y: pts[RIGHT_I].y - 160 };
    if (phase === "knockout")
      return { x: (pts[LEFT_TARGET].x + pts[RIGHT_TARGET].x) / 2 + 100, y: pts[RIGHT_I].y + 160 };
    return pts[RIGHT_I];
  };

  // Per-phase transition timings (ms)
  const transForPhase = (p: Phase) => {
    switch (p) {
      case "run":
        return 1400;
      case "jump":
        return 650;
      case "fight1":
      case "fight2":
      case "fight3":
        return 150;
      case "knockout":
        return 500;
      case "exit":
        return 850;
      default:
        return 350;
    }
  };

  const showFigures = pts && phase !== "intro" && phase !== "pop";
  const hideOriginalI = phase !== "intro";

  // Zoom transform for comic effect — focuses on clash point
  const zoomTransform = () => {
    if (!pts) return "scale(1) translate(0,0)";
    if (phase === "jump" || phase === "fight1" || phase === "fight2" || phase === "fight3" || phase === "knockout") {
      const clashX = (pts[LEFT_TARGET].x + pts[RIGHT_TARGET].x) / 2;
      const clashY = pts[LEFT_I].y - 150;
      const w = wrapRef.current?.clientWidth ?? 400;
      const h = wrapRef.current?.clientHeight ?? 800;
      const dx = w / 2 - clashX;
      const dy = h / 2 - clashY;
      const shake =
        phase === "fight1" ? "translate(4px,-2px)" :
        phase === "fight2" ? "translate(-5px,3px)" :
        phase === "fight3" ? "translate(3px,4px)" : "";
      return `translate(${dx}px, ${dy}px) scale(1.7) ${shake}`;
    }
    return "translate(0,0) scale(1)";
  };

  const leftP = leftPos();
  const rightP = rightPos();

  return (
    <div
      className={`fixed inset-0 z-[9999] overflow-hidden bg-black transition-opacity duration-500 ${
        phase === "fade" || phase === "done" ? "opacity-0" : "opacity-100"
      }`}
      style={{ pointerEvents: phase === "done" ? "none" : "auto" }}
      aria-hidden
    >
      <div
        ref={wrapRef}
        className="relative h-full w-full"
        style={{
          transform: zoomTransform(),
          transformOrigin: "center center",
          transition: "transform 600ms cubic-bezier(.4,.0,.2,1)",
        }}
      >
        {/* Title — matches LaunchScreen layout */}
        <h1
          ref={titleRef}
          className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 whitespace-nowrap text-center font-bold"
          style={{
            fontFamily: "Inter, -apple-system, system-ui, sans-serif",
            fontSize: "clamp(20px, 6.2vw, 34px)",
            letterSpacing: "0.18em",
            color: "#FFFFFF",
          }}
        >
          {CHARS.map((c, i) => {
            const isDot = c === ".";
            const isI = i === LEFT_I || i === RIGHT_I;
            const hide = isI && hideOriginalI;
            return (
              <span
                key={i}
                ref={(el) => {
                  letterRefs.current[i] = el;
                }}
                style={{
                  display: "inline-block",
                  color: isDot ? "#E8262B" : "#FFFFFF",
                  opacity: hide ? 0 : 1,
                  transform:
                    isI && phase === "pop"
                      ? "scale(1.6) translateY(-6px)"
                      : "scale(1)",
                  transition: "transform 280ms cubic-bezier(.34,1.56,.64,1), opacity 120ms linear",
                  whiteSpace: "pre",
                }}
              >
                {c === " " ? "\u00A0" : c}
              </span>
            );
          })}
        </h1>

        {/* Byline — matches LaunchScreen footer */}
        <div
          className="absolute bottom-0 left-0 right-0 pb-12 text-center"
          style={{
            fontFamily: "Inter, -apple-system, system-ui, sans-serif",
            color: "rgba(255,255,255,0.55)",
            fontSize: "clamp(11px, 3.3vw, 14px)",
            letterSpacing: "0.02em",
            opacity: phase === "fight1" || phase === "fight2" || phase === "fight3" || phase === "knockout" ? 0 : 1,
            transition: "opacity 300ms",
          }}
        >
          By Ben Sandman and Ryan Davidoff
        </div>

        {/* Comic burst FX on clash */}
        {(phase === "fight1" || phase === "fight2" || phase === "fight3") && pts && (
          <ComicBurst
            x={(pts[LEFT_TARGET].x + pts[RIGHT_TARGET].x) / 2}
            y={pts[LEFT_I].y - 150}
            label={phase === "fight1" ? "POW!" : phase === "fight2" ? "BAM!" : "K.O.!"}
          />
        )}

        {/* Stick figures */}
        {showFigures && pts && (
          <>
            <Figure
              pos={leftP}
              facing="right"
              pose={
                phase === "morph" ? "stand" :
                phase === "run" ? "run" :
                phase === "jump" ? "jump" :
                phase === "fight1" ? "punch-r" :
                phase === "fight2" ? "block" :
                phase === "fight3" ? "punch-r" :
                phase === "knockout" ? "victory" :
                phase === "exit" || phase === "fade" || phase === "done" ? "run" :
                "stand"
              }
              transition={transForPhase(phase)}
              appear={phase === "morph"}
            />
            <Figure
              pos={rightP}
              facing="left"
              pose={
                phase === "morph" ? "stand" :
                phase === "run" ? "run" :
                phase === "jump" ? "jump" :
                phase === "fight1" ? "block" :
                phase === "fight2" ? "punch-r" :
                phase === "fight3" ? "hit" :
                phase === "knockout" ? "ko" :
                "ko"
              }
              transition={transForPhase(phase)}
              appear={phase === "morph"}
              spin={phase === "knockout"}
            />
          </>
        )}
      </div>
    </div>
  );
}

function ComicBurst({ x, y, label }: { x: number; y: number; label: string }) {
  return (
    <div
      className="pointer-events-none absolute"
      style={{
        left: x,
        top: y,
        transform: "translate(-50%, -50%)",
        animation: "koth-burst 200ms ease-out",
      }}
    >
      <svg width="140" height="140" viewBox="-70 -70 140 140">
        <polygon
          points="-60,-10 -32,-22 -22,-50 -6,-30 14,-58 22,-30 48,-46 38,-18 64,-6 36,8 50,36 22,24 18,52 0,30 -22,54 -22,28 -52,40 -36,16 -62,18"
          fill="#FFEB3B"
          stroke="#0a0a0a"
          strokeWidth="3"
          strokeLinejoin="round"
        />
        <text
          x="0"
          y="6"
          textAnchor="middle"
          fontFamily="Inter, system-ui, sans-serif"
          fontWeight="900"
          fontSize="22"
          fill="#0a0a0a"
          letterSpacing="1"
        >
          {label}
        </text>
      </svg>
      <style>{`@keyframes koth-burst { 0% { transform: translate(-50%,-50%) scale(0.4); opacity: 0; } 60% { transform: translate(-50%,-50%) scale(1.15); opacity: 1; } 100% { transform: translate(-50%,-50%) scale(1); opacity: 1; } }`}</style>
    </div>
  );
}

type Pose = "stand" | "run" | "jump" | "punch-r" | "block" | "hit" | "victory" | "ko";

function Figure({
  pos,
  facing,
  pose,
  transition,
  appear,
  spin = false,
}: {
  pos: Pt;
  facing: "left" | "right";
  pose: Pose;
  transition: number;
  appear?: boolean;
  spin?: boolean;
}) {
  const flip = facing === "left" ? -1 : 1;
  return (
    <div
      className="absolute"
      style={{
        left: 0,
        top: 0,
        transform: `translate(${pos.x}px, ${pos.y}px)`,
        transition: `transform ${transition}ms ${pose === "run" ? "linear" : pose === "jump" ? "cubic-bezier(.2,.8,.3,1)" : "cubic-bezier(.4,0,.2,1)"}`,
      }}
    >
      <div
        style={{
          transform: `translate(-50%, -50%) scaleX(${flip}) ${appear ? "scale(1)" : ""} ${spin ? "rotate(180deg)" : ""}`,
          transformOrigin: "center",
          transition: "transform 400ms",
          animation: appear ? "koth-pop-in 350ms cubic-bezier(.34,1.56,.64,1)" : undefined,
        }}
      >
        <PoseSvg pose={pose} />
      </div>
      <style>{`
        @keyframes koth-pop-in {
          0% { transform: translate(-50%,-50%) scale(0.3); opacity: 0; }
          60% { transform: translate(-50%,-50%) scale(1.25); opacity: 1; }
          100% { transform: translate(-50%,-50%) scale(1); opacity: 1; }
        }
        @keyframes koth-run-legs {
          0%, 100% { transform: rotate(25deg); }
          50% { transform: rotate(-25deg); }
        }
        @keyframes koth-run-legs-alt {
          0%, 100% { transform: rotate(-25deg); }
          50% { transform: rotate(25deg); }
        }
      `}</style>
    </div>
  );
}

function PoseSvg({ pose }: { pose: Pose }) {
  const stroke = "#FFFFFF";
  // viewBox: figure ~ 36w x 60h, head at top, feet near y=20
  const common = { fill: "none" as const, stroke, strokeWidth: 2.4, strokeLinecap: "round" as const };
  return (
    <svg width="44" height="64" viewBox="-22 -38 44 64" overflow="visible">
      {/* Head */}
      <circle cx="0" cy={pose === "ko" ? -10 : -28} r="5" fill={stroke} />
      {/* Body */}
      {pose === "ko" ? (
        <g>
          {/* lying on ground */}
          <line x1="-12" y1="18" x2="14" y2="14" {...common} />
          <line x1="14" y1="14" x2="20" y2="20" {...common} />
          <line x1="14" y1="14" x2="20" y2="8" {...common} />
          <line x1="-12" y1="18" x2="-6" y2="22" {...common} />
          <line x1="-12" y1="18" x2="-18" y2="22" {...common} />
          {/* x eyes implied by tilt */}
        </g>
      ) : pose === "jump" ? (
        <g>
          <line x1="0" y1="-22" x2="0" y2="-2" {...common} />
          {/* arms up */}
          <line x1="0" y1="-20" x2="-10" y2="-32" {...common} />
          <line x1="0" y1="-20" x2="10" y2="-32" {...common} />
          {/* legs tucked */}
          <line x1="0" y1="-2" x2="-6" y2="6" {...common} />
          <line x1="0" y1="-2" x2="6" y2="6" {...common} />
        </g>
      ) : pose === "run" ? (
        <g>
          <line x1="0" y1="-22" x2="0" y2="-4" {...common} />
          {/* arms swinging */}
          <line x1="0" y1="-18" x2="10" y2="-10" {...common} />
          <line x1="0" y1="-18" x2="-8" y2="-22" {...common} />
          {/* legs cycling via animation */}
          <g style={{ transformOrigin: "0px -4px", animation: "koth-run-legs 320ms linear infinite" }}>
            <line x1="0" y1="-4" x2="8" y2="14" {...common} />
          </g>
          <g style={{ transformOrigin: "0px -4px", animation: "koth-run-legs-alt 320ms linear infinite" }}>
            <line x1="0" y1="-4" x2="-8" y2="14" {...common} />
          </g>
        </g>
      ) : pose === "punch-r" ? (
        <g>
          <line x1="0" y1="-22" x2="0" y2="-2" {...common} />
          {/* lead punch right */}
          <line x1="0" y1="-20" x2="16" y2="-22" {...common} />
          <circle cx="16" cy="-22" r="2.5" fill={stroke} />
          <line x1="0" y1="-20" x2="-8" y2="-12" {...common} />
          <line x1="0" y1="-2" x2="-6" y2="14" {...common} />
          <line x1="0" y1="-2" x2="6" y2="14" {...common} />
        </g>
      ) : pose === "block" ? (
        <g>
          <line x1="0" y1="-22" x2="0" y2="-2" {...common} />
          {/* both arms up crossing face */}
          <line x1="0" y1="-20" x2="10" y2="-30" {...common} />
          <line x1="0" y1="-20" x2="-10" y2="-30" {...common} />
          <line x1="0" y1="-2" x2="-7" y2="14" {...common} />
          <line x1="0" y1="-2" x2="7" y2="14" {...common} />
        </g>
      ) : pose === "hit" ? (
        <g>
          {/* leaning back */}
          <line x1="0" y1="-22" x2="-6" y2="-2" {...common} />
          <line x1="0" y1="-22" x2="-12" y2="-26" {...common} />
          <line x1="0" y1="-22" x2="-14" y2="-16" {...common} />
          <line x1="-6" y1="-2" x2="-12" y2="14" {...common} />
          <line x1="-6" y1="-2" x2="2" y2="14" {...common} />
        </g>
      ) : pose === "victory" ? (
        <g>
          <line x1="0" y1="-22" x2="0" y2="-2" {...common} />
          <line x1="0" y1="-20" x2="-10" y2="-34" {...common} />
          <line x1="0" y1="-20" x2="10" y2="-34" {...common} />
          <line x1="0" y1="-2" x2="-6" y2="14" {...common} />
          <line x1="0" y1="-2" x2="6" y2="14" {...common} />
        </g>
      ) : (
        <g>
          {/* stand */}
          <line x1="0" y1="-22" x2="0" y2="-2" {...common} />
          <line x1="0" y1="-18" x2="-8" y2="-10" {...common} />
          <line x1="0" y1="-18" x2="8" y2="-10" {...common} />
          <line x1="0" y1="-2" x2="-6" y2="14" {...common} />
          <line x1="0" y1="-2" x2="6" y2="14" {...common} />
        </g>
      )}
    </svg>
  );
}
