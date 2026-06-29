import { useEffect, useState, useMemo } from "react";
import { CrownPath } from "./logo-mark";

/**
 * Splash intro overlay — plays once per app load.
 *
 * Sequence (total ~2s):
 *   0.00s  identical to LaunchScreen.storyboard (black bg, crown, hill, title, credits)
 *   0.05s  bottom credits fade out
 *   0.25s  title fades + letter-tracks apart
 *   0.35s  camera dolly begins — hill grows, crown lifts off
 *   0.50s  red/black geometric shards fly past (sporty, athletic)
 *   1.50s  hill nearly fills the screen
 *   1.90s  red diagonal wipe
 *   2.00s  unmount → home/auth
 */
export function SplashIntro({ onDone }: { onDone: () => void }) {
  const [gone, setGone] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => {
      setGone(true);
      // small delay so the wipe finishes painting before unmount
      setTimeout(onDone, 80);
    }, 2000);
    return () => clearTimeout(t);
  }, [onDone]);

  // Pre-generate shard configs once
  const shards = useMemo(() => buildShards(), []);

  if (gone) return null;

  return (
    <div
      className="koth-splash-root fixed inset-0 z-[9999] overflow-hidden bg-black"
      style={{ pointerEvents: "none" }}
      aria-hidden
    >
      {/* Stage — fills screen, perspective for depth */}
      <div className="koth-stage absolute inset-0">
        {/* Shards layer — sits BEHIND the hill so the hill grows over them, like flying in */}
        <svg
          className="koth-shards absolute inset-0 h-full w-full"
          viewBox="0 0 400 800"
          preserveAspectRatio="xMidYMid slice"
        >
          {shards.map((s, i) => (
            <g
              key={i}
              className="koth-shard"
              style={{
                // CSS vars consumed by the keyframes
                ["--sx" as string]: `${s.x}px`,
                ["--sy" as string]: `${s.y}px`,
                ["--sr" as string]: `${s.rot}deg`,
                ["--sd" as string]: `${s.delay}s`,
                ["--ss" as string]: `${s.scale}`,
              }}
            >
              <ShardShape kind={s.kind} fill={s.fill} stroke={s.stroke} />
            </g>
          ))}
        </svg>

        {/* Hero — exact launch-screen composition, then dollies forward */}
        <div className="koth-hero absolute inset-0 flex flex-col items-center justify-center">
          <svg
            viewBox="0 0 400 800"
            className="block h-full w-full"
            preserveAspectRatio="xMidYMid meet"
          >
            {/* Crown — floats above hill, then lifts off-screen */}
            <g className="koth-crown" transform="translate(200 330)">
              <g transform="scale(1.6)">
                <CrownPath />
              </g>
            </g>

            {/* Hill — two-tone red, centered. Grows via transform on its group. */}
            <g className="koth-hill">
              <polygon points="200,360 90,560 200,560" fill="#E8262B" />
              <polygon points="200,360 310,560 200,560" fill="#B81F23" />
            </g>

            {/* Title */}
            <g className="koth-title">
              <text
                x="200"
                y="640"
                textAnchor="middle"
                fontFamily="-apple-system, system-ui, sans-serif"
                fontWeight="700"
                fontSize="22"
                letterSpacing="3"
                fill="#FFFFFF"
              >
                <tspan>KING</tspan>
                <tspan fill="#E8262B">.</tspan>
                <tspan> OF</tspan>
                <tspan fill="#E8262B">.</tspan>
                <tspan> THE</tspan>
                <tspan fill="#E8262B">.</tspan>
                <tspan> HILL</tspan>
                <tspan fill="#E8262B">.</tspan>
              </text>
            </g>

            {/* Credits */}
            <g className="koth-credits">
              <text
                x="200"
                y="745"
                textAnchor="middle"
                fontFamily="-apple-system, system-ui, sans-serif"
                fontSize="12"
                fill="#FFFFFF"
                opacity="0.55"
              >
                App Developed by{" "}
                <tspan fill="#FFFFFF" opacity="1">
                  Ben Sandman
                </tspan>
              </text>
              <text
                x="200"
                y="765"
                textAnchor="middle"
                fontFamily="-apple-system, system-ui, sans-serif"
                fontSize="12"
                fill="#FFFFFF"
                opacity="0.55"
              >
                Co-owned by{" "}
                <tspan fill="#FFFFFF" opacity="1">
                  Ryan Davidoff
                </tspan>
              </text>
            </g>
          </svg>
        </div>

        {/* Red diagonal wipe — final transition */}
        <div className="koth-wipe absolute inset-0" />
      </div>

      <style>{`
        .koth-stage {
          perspective: 800px;
          transform-style: preserve-3d;
        }

        /* ===== Credits — fade out fast ===== */
        .koth-credits {
          animation: koth-credits-out 0.25s ease-out 0.05s forwards;
        }
        @keyframes koth-credits-out {
          to { opacity: 0; transform: translateY(8px); }
        }

        /* ===== Title — fade + track apart ===== */
        .koth-title {
          transform-origin: 200px 640px;
          animation: koth-title-out 0.35s ease-out 0.25s forwards;
        }
        @keyframes koth-title-out {
          to { opacity: 0; letter-spacing: 8px; transform: scale(1.05); }
        }

        /* ===== Hill — camera dolly: grow & drift slightly down/off ===== */
        .koth-hill {
          transform-origin: 200px 560px;
          animation: koth-hill-zoom 1.65s cubic-bezier(.55,.05,.7,1) 0.35s forwards;
          will-change: transform;
        }
        @keyframes koth-hill-zoom {
          0%   { transform: scale(1) translateY(0); }
          60%  { transform: scale(3.2) translateY(20px); }
          100% { transform: scale(9) translateY(60px); }
        }

        /* ===== Crown — lifts up & off ===== */
        .koth-crown {
          transform-origin: 200px 330px;
          animation: koth-crown-up 1.4s cubic-bezier(.5,.05,.6,1) 0.35s forwards;
        }
        @keyframes koth-crown-up {
          0%   { transform: translate(200px, 330px); opacity: 1; }
          70%  { transform: translate(200px, 120px); opacity: 1; }
          100% { transform: translate(200px, -120px); opacity: 0; }
        }

        /* ===== Shards — fly past camera ===== */
        .koth-shards { opacity: 0; animation: koth-shards-on 0.2s linear 0.5s forwards; }
        @keyframes koth-shards-on { to { opacity: 1; } }

        .koth-shard {
          transform-origin: 200px 400px;
          transform: translate(var(--sx), var(--sy)) scale(0.05) rotate(0deg);
          opacity: 0;
          animation: koth-shard-fly 1.4s cubic-bezier(.4,0,.7,1) infinite;
          animation-delay: var(--sd);
        }
        @keyframes koth-shard-fly {
          0%   { transform: translate(var(--sx), var(--sy)) scale(0.05) rotate(0deg); opacity: 0; }
          15%  { opacity: 1; }
          100% { transform: translate(calc(var(--sx) * 14), calc(var(--sy) * 14)) scale(calc(var(--ss) * 4)) rotate(var(--sr)); opacity: 0; }
        }

        /* ===== Final red wipe ===== */
        .koth-wipe {
          background: linear-gradient(115deg, transparent 0%, transparent 40%, #E8262B 50%, #B81F23 100%);
          transform: translateX(-110%);
          animation: koth-wipe-in 0.35s cubic-bezier(.6,0,.4,1) 1.75s forwards;
        }
        @keyframes koth-wipe-in {
          0%   { transform: translateX(-110%); }
          70%  { transform: translateX(0); }
          100% { transform: translateX(0); background: #E8262B; }
        }

        /* Whole splash fades out at the very end so the swap to home is clean */
        .koth-splash-root {
          animation: koth-root-out 0.25s ease-in 1.85s forwards;
        }
        @keyframes koth-root-out {
          to { opacity: 0; }
        }

        @media (prefers-reduced-motion: reduce) {
          .koth-shard, .koth-hill, .koth-crown, .koth-title, .koth-credits, .koth-wipe, .koth-splash-root {
            animation-duration: 0.01s !important;
            animation-delay: 0s !important;
          }
        }
      `}</style>
    </div>
  );
}

/* ---------------- Shapes ---------------- */

type ShardKind = "triangle" | "parallelogram" | "polygon" | "streak" | "shard";

function ShardShape({
  kind,
  fill,
  stroke,
}: {
  kind: ShardKind;
  fill: string;
  stroke?: string;
}) {
  const strokeW = stroke ? 1.2 : 0;
  switch (kind) {
    case "triangle":
      return (
        <polygon
          points="0,-10 11,8 -11,8"
          fill={fill}
          stroke={stroke}
          strokeWidth={strokeW}
        />
      );
    case "parallelogram":
      return (
        <polygon
          points="-14,-6 10,-6 14,6 -10,6"
          fill={fill}
          stroke={stroke}
          strokeWidth={strokeW}
        />
      );
    case "polygon":
      return (
        <polygon
          points="-9,-9 9,-6 11,8 -4,11 -12,2"
          fill={fill}
          stroke={stroke}
          strokeWidth={strokeW}
        />
      );
    case "streak":
      return (
        <rect
          x="-22"
          y="-1.5"
          width="44"
          height="3"
          fill={fill}
          stroke={stroke}
          strokeWidth={strokeW}
        />
      );
    case "shard":
      return (
        <polygon
          points="-3,-14 6,-4 2,12 -7,4"
          fill={fill}
          stroke={stroke}
          strokeWidth={strokeW}
        />
      );
  }
}

/* ---------------- Shard generation ---------------- */

function buildShards() {
  const kinds: ShardKind[] = [
    "triangle",
    "parallelogram",
    "polygon",
    "streak",
    "shard",
  ];
  const palette = [
    { fill: "#E8262B" },
    { fill: "#B81F23" },
    { fill: "#0A0A0A", stroke: "#E8262B" },
    { fill: "#E8262B" },
    { fill: "#1A1A1A", stroke: "#FF2028" },
  ];

  // Deterministic pseudo-random so SSR + client agree.
  let seed = 1337;
  const rand = () => {
    seed = (seed * 9301 + 49297) % 233280;
    return seed / 233280;
  };

  const list: Array<{
    x: number;
    y: number;
    rot: number;
    delay: number;
    scale: number;
    kind: ShardKind;
    fill: string;
    stroke?: string;
  }> = [];

  for (let i = 0; i < 28; i++) {
    // Direction from center, biased outward
    const angle = rand() * Math.PI * 2;
    const dist = 30 + rand() * 90;
    const x = Math.cos(angle) * dist;
    const y = Math.sin(angle) * dist * 1.1;
    const c = palette[Math.floor(rand() * palette.length)];
    list.push({
      x,
      y,
      rot: (rand() - 0.5) * 540,
      delay: 0.5 + rand() * 1.2,
      scale: 0.8 + rand() * 1.4,
      kind: kinds[Math.floor(rand() * kinds.length)],
      fill: c.fill,
      stroke: c.stroke,
    });
  }
  return list;
}
