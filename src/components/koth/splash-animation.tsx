import { CrownPath } from "./logo-mark";

/**
 * Splash hero animation:
 *   1. Stick figure runs in and stops to the LEFT of the hill (not on it).
 *   2. Crouches a few times to charge up — white energy rings pulse out.
 *   3. BLASTOFF — ground-impact starburst, figure rockets up to the apex.
 *   4. Reaches into the sky; a crown drops from above into his hand.
 *   5. SLAMS the crown onto the peak with an impact flash.
 *   6. Blasts off diagonally into space with a comet trail. Crown stays. Loops.
 */
export function SplashAnimation() {
  return (
    <div className="relative mx-auto w-full max-w-[340px]">
      <svg viewBox="0 0 400 280" className="block h-auto w-full" aria-hidden>
        {/* Ground line */}
        <line x1="0" y1="240" x2="400" y2="240" stroke="#FFFFFF" strokeOpacity="0.15" strokeWidth="1" />

        {/* Hill — split into two close reds */}
        <polygon points="200,90 60,240 200,240" fill="#E8262B" />
        <polygon points="200,90 340,240 200,240" fill="#B81F23" />

        {/* Charge-up rings at the launch spot */}
        <g className="koth-charge">
          <circle cx="0" cy="-18" r="14" fill="none" stroke="#FFFFFF" strokeWidth="1.5" />
          <circle cx="0" cy="-18" r="22" fill="none" stroke="#FFFFFF" strokeWidth="1" />
          <circle cx="0" cy="-18" r="30" fill="none" stroke="#FFFFFF" strokeWidth="0.75" />
        </g>

        {/* Ground-impact starburst at blastoff */}
        <g className="koth-impact" transform="translate(60 240)">
          <Starburst />
        </g>

        {/* Apex slam-impact flash */}
        <g className="koth-slam" transform="translate(200 78)">
          <Starburst small />
        </g>

        {/* Comet trail behind the figure during the final blastoff */}
        <g className="koth-trail">
          <polygon
            points="0,0 -8,4 -80,40 -90,38 -82,32"
            fill="url(#trailGrad)"
            opacity="0.9"
          />
        </g>

        {/* Crown — falls from the sky, slams onto apex, stays */}
        <g className="koth-crown">
          <CrownPath />
        </g>

        {/* Stick figure: outer = position, middle = squash, inner = arms-up swap */}
        <g className="koth-figure">
          <g className="koth-crouch">
            <g className="koth-arms-down">
              <StickFigure />
            </g>
            <g className="koth-arms-up">
              <StickFigure armsUp />
            </g>
          </g>
        </g>

        <defs>
          <linearGradient id="trailGrad" x1="1" y1="0" x2="0" y2="0.5">
            <stop offset="0%" stopColor="#FFFFFF" stopOpacity="1" />
            <stop offset="60%" stopColor="#FFFFFF" stopOpacity="0.4" />
            <stop offset="100%" stopColor="#FFFFFF" stopOpacity="0" />
          </linearGradient>
        </defs>
      </svg>

      <style>{`
        /* ===== Figure position ===== */
        .koth-figure {
          transform: translate(-60px, 240px);
          animation: koth-figure-path 8s ease-in-out infinite;
        }
        @keyframes koth-figure-path {
          0%   { transform: translate(-60px, 240px); }
          12%  { transform: translate(60px, 240px); }              /* arrive LEFT of hill */
          44%  { transform: translate(60px, 240px); }              /* finish charging */
          52%  { transform: translate(200px, 90px); animation-timing-function: cubic-bezier(.2,.9,.3,1); } /* land on apex */
          66%  { transform: translate(200px, 90px); }              /* hold for slam */
          76%  { transform: translate(300px, 60px); }              /* lift off */
          90%, 100% { transform: translate(520px, -120px); }       /* blast into space */
        }

        /* ===== Crouch squash ===== */
        .koth-crouch {
          transform-origin: 0 0;
          animation: koth-crouch 8s ease-in-out infinite;
        }
        @keyframes koth-crouch {
          0%, 14%   { transform: scaleY(1) scaleX(1); }
          18%       { transform: scaleY(0.75) scaleX(1.1); }
          22%       { transform: scaleY(1) scaleX(1); }
          26%       { transform: scaleY(0.7) scaleX(1.15); }
          30%       { transform: scaleY(1) scaleX(1); }
          38%       { transform: scaleY(0.5) scaleX(1.3); }
          44%       { transform: scaleY(0.5) scaleX(1.3); }
          46%       { transform: scaleY(1.35) scaleX(0.8); }       /* blastoff stretch */
          52%, 100% { transform: scaleY(1) scaleX(1); }
        }

        /* ===== Arms up swap (while reaching for / slamming the crown) ===== */
        .koth-arms-down { opacity: 1; animation: koth-arms-down 8s steps(1, end) infinite; }
        .koth-arms-up   { opacity: 0; animation: koth-arms-up   8s steps(1, end) infinite; }
        @keyframes koth-arms-down {
          0%, 51% { opacity: 1; }
          52%, 67% { opacity: 0; }
          68%, 100% { opacity: 1; }
        }
        @keyframes koth-arms-up {
          0%, 51% { opacity: 0; }
          52%, 67% { opacity: 1; }
          68%, 100% { opacity: 0; }
        }

        /* ===== Charge rings at (60,240) ===== */
        .koth-charge {
          transform: translate(60px, 240px) scale(0.4);
          opacity: 0;
          animation: koth-charge 8s ease-out infinite;
        }
        @keyframes koth-charge {
          0%, 30%   { opacity: 0; transform: translate(60px, 240px) scale(0.4); }
          36%       { opacity: 1; transform: translate(60px, 240px) scale(0.7); }
          43%       { opacity: 0.9; transform: translate(60px, 240px) scale(1.05); }
          46%       { opacity: 0; transform: translate(60px, 240px) scale(1.6); }
          100%      { opacity: 0; transform: translate(60px, 240px) scale(0.4); }
        }

        /* ===== Ground impact at blastoff ===== */
        .koth-impact {
          opacity: 0;
          transform-box: fill-box;
          transform-origin: center;
          animation: koth-impact 8s ease-out infinite;
        }
        @keyframes koth-impact {
          0%, 44%   { opacity: 0; transform: translate(60px, 240px) scale(0.3); }
          46%       { opacity: 1; transform: translate(60px, 240px) scale(1); }
          50%       { opacity: 0; transform: translate(60px, 240px) scale(1.8); }
          100%      { opacity: 0; transform: translate(60px, 240px) scale(0.3); }
        }

        /* ===== Apex slam impact ===== */
        .koth-slam {
          opacity: 0;
          animation: koth-slam 8s ease-out infinite;
        }
        @keyframes koth-slam {
          0%, 63%   { opacity: 0; transform: translate(200px, 78px) scale(0.3); }
          65%       { opacity: 1; transform: translate(200px, 78px) scale(1); }
          69%       { opacity: 0; transform: translate(200px, 78px) scale(1.6); }
          100%      { opacity: 0; transform: translate(200px, 78px) scale(0.3); }
        }

        /* ===== Comet trail (only during final blastoff) ===== */
        .koth-trail {
          opacity: 0;
          transform: translate(-60px, 240px);
          animation: koth-trail 8s ease-in infinite;
        }
        @keyframes koth-trail {
          0%, 67%   { opacity: 0; transform: translate(200px, 90px); }
          70%       { opacity: 1; transform: translate(220px, 84px); }
          80%       { opacity: 0.9; transform: translate(320px, 50px); }
          90%, 100% { opacity: 0; transform: translate(520px, -120px); }
        }

        /* ===== Crown — descends from sky, slams, rests ===== */
        .koth-crown {
          opacity: 0;
          transform: translate(200px, -10px) scale(1.1);
          animation: koth-crown-place 8s ease-in-out infinite;
        }
        @keyframes koth-crown-place {
          0%, 52%   { opacity: 0; transform: translate(200px, -10px) scale(1.1); }
          56%       { opacity: 1; transform: translate(200px, 40px) scale(1.15); } /* in the sky, visible */
          63%       { opacity: 1; transform: translate(200px, 60px) scale(1.2); }  /* in figure's hands */
          66%       { opacity: 1; transform: translate(200px, 78px) scale(1.4); }  /* SLAM */
          70%, 100% { opacity: 1; transform: translate(200px, 78px) scale(1.2); }  /* rest on apex */
        }
      `}</style>
    </div>
  );
}

function StickFigure({ armsUp = false, flying = false }: { armsUp?: boolean; flying?: boolean }) {
  const stroke = "#FFFFFF";
  return (
    <g fill="none" stroke={stroke} strokeWidth="2.5" strokeLinecap="round">
      <circle cx="0" cy="-36" r="5.5" fill={stroke} stroke="none" />
      <line x1="0" y1="-30" x2="0" y2="-14" />
      {flying ? (
        <>
          {/* arms forward like Superman */}
          <line x1="0" y1="-28" x2="14" y2="-34" />
          <line x1="0" y1="-28" x2="14" y2="-22" />
        </>
      ) : armsUp ? (
        <>
          <line x1="0" y1="-30" x2="-7" y2="-46" />
          <line x1="0" y1="-30" x2="7" y2="-46" />
        </>
      ) : (
        <>
          <line x1="0" y1="-25" x2="-10" y2="-17" />
          <line x1="0" y1="-25" x2="10" y2="-17" />
        </>
      )}
      {flying ? (
        <>
          {/* legs straight back */}
          <line x1="0" y1="-14" x2="-10" y2="-10" />
          <line x1="0" y1="-14" x2="-10" y2="-4" />
        </>
      ) : (
        <>
          <line x1="0" y1="-14" x2="-7" y2="-1" />
          <line x1="0" y1="-14" x2="7" y2="-1" />
        </>
      )}
    </g>
  );
}

function GroundBurst() {
  const stroke = "#FFFFFF";
  const rays = [
    { x1: 0, y1: 0, x2: -28, y2: -4 },
    { x1: 0, y1: 0, x2: -20, y2: -10 },
    { x1: 0, y1: 0, x2: -8, y2: -14 },
    { x1: 0, y1: 0, x2: 8, y2: -14 },
    { x1: 0, y1: 0, x2: 20, y2: -10 },
    { x1: 0, y1: 0, x2: 28, y2: -4 },
    { x1: 0, y1: 0, x2: 0, y2: -8 },
  ];
  return (
    <g stroke={stroke} strokeWidth="1.6" strokeLinecap="round" fill="none">
      {rays.map((r, i) => (
        <line key={i} x1={r.x1} y1={r.y1} x2={r.x2} y2={r.y2} />
      ))}
      {/* dust puffs */}
      <ellipse cx="-18" cy="-2" rx="6" ry="2" fill="#FFFFFF" fillOpacity="0.3" stroke="none" />
      <ellipse cx="18" cy="-2" rx="5" ry="2" fill="#FFFFFF" fillOpacity="0.25" stroke="none" />
      <ellipse cx="0" cy="-4" rx="4" ry="2" fill="#FFFFFF" fillOpacity="0.35" stroke="none" />
    </g>
  );
}

function Starburst({ small = false }: { small?: boolean }) {
  const r1 = small ? 6 : 8;
  const r2 = small ? 16 : 22;
  const stroke = "#FFFFFF";
  const spokes = [0, 45, 90, 135, 180, 225, 270, 315];
  return (
    <g stroke={stroke} strokeWidth="1.8" strokeLinecap="round" fill="none">
      {spokes.map((deg) => {
        const rad = (deg * Math.PI) / 180;
        return (
          <line
            key={deg}
            x1={Math.cos(rad) * r1}
            y1={Math.sin(rad) * r1}
            x2={Math.cos(rad) * r2}
            y2={Math.sin(rad) * r2}
          />
        );
      })}
      <circle cx="0" cy="0" r={r1} stroke={stroke} strokeWidth="1.5" fill="none" />
    </g>
  );
}
