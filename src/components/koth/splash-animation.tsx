import { CrownPath } from "./logo-mark";

/**
 * Splash animation:
 *   1. Stick figure runs in from the left and stops at the base of the hill.
 *   2. Crouches three times, charging up (energy rings pulse on the last one).
 *   3. Explodes upward, jumps to the apex, and places the crown.
 *   4. Hops down the right side and runs off-screen. Crown stays put. Loops.
 */
export function SplashAnimation() {
  return (
    <div className="relative mx-auto w-full max-w-[340px]">
      <svg viewBox="0 0 400 280" className="block h-auto w-full" aria-hidden>
        {/* Ground line */}
        <line
          x1="0"
          y1="240"
          x2="400"
          y2="240"
          stroke="#FFFFFF"
          strokeOpacity="0.15"
          strokeWidth="1"
        />

        {/* Hill — split into two close reds */}
        <polygon points="200,90 60,240 200,240" fill="#E8262B" />
        <polygon points="200,90 340,240 200,240" fill="#B81F23" />

        {/* Crown — snaps onto the apex when the figure lands */}
        <g className="koth-crown">
          <CrownPath />
        </g>

        {/* Charge-up rings (only visible during power-up phase) */}
        <g className="koth-charge">
          <circle cx="0" cy="-18" r="14" fill="none" stroke="#FFFFFF" strokeWidth="1.5" opacity="0.9" />
          <circle cx="0" cy="-18" r="22" fill="none" stroke="#FFFFFF" strokeWidth="1" opacity="0.6" />
          <circle cx="0" cy="-18" r="30" fill="none" stroke="#FFFFFF" strokeWidth="0.75" opacity="0.35" />
        </g>

        {/* Stick figure — outer group does position, inner group does crouch squash */}
        <g className="koth-figure">
          <g className="koth-crouch">
            <StickFigure />
          </g>
        </g>
      </svg>

      <style>{`
        /* ----- Figure path (position only) ----- */
        .koth-figure {
          transform: translate(-60px, 240px);
          animation: koth-figure-path 7s ease-in-out infinite;
        }
        @keyframes koth-figure-path {
          0%   { transform: translate(-60px, 240px); }
          12%  { transform: translate(120px, 240px); } /* arrive at hill base, left side */
          50%  { transform: translate(120px, 240px); } /* hold while crouching/charging */
          58%  { transform: translate(200px, 90px); animation-timing-function: ease-out; } /* peak */
          68%  { transform: translate(200px, 90px); } /* plant crown */
          78%  { transform: translate(280px, 240px); } /* down the right side */
          92%, 100% { transform: translate(480px, 240px); } /* run off right */
        }

        /* ----- Crouch squash (inner group) ----- */
        .koth-crouch {
          transform-origin: 0 0;
          animation: koth-crouch 7s ease-in-out infinite;
        }
        @keyframes koth-crouch {
          0%, 14%   { transform: scaleY(1) scaleX(1); }
          /* crouch 1 */
          18%       { transform: scaleY(0.75) scaleX(1.1); }
          22%       { transform: scaleY(1) scaleX(1); }
          /* crouch 2 */
          26%       { transform: scaleY(0.7) scaleX(1.15); }
          30%       { transform: scaleY(1) scaleX(1); }
          /* crouch 3 — deeper, holds while charging */
          36%       { transform: scaleY(0.55) scaleX(1.25); }
          48%       { transform: scaleY(0.55) scaleX(1.25); }
          /* explode upward into the jump */
          52%       { transform: scaleY(1.25) scaleX(0.85); }
          58%, 100% { transform: scaleY(1) scaleX(1); }
        }

        /* ----- Charge rings (positioned to match figure base) ----- */
        .koth-charge {
          transform: translate(120px, 240px);
          opacity: 0;
          animation: koth-charge 7s ease-out infinite;
          transform-origin: 120px 222px;
        }
        @keyframes koth-charge {
          0%, 35%   { opacity: 0; transform: translate(120px, 240px) scale(0.4); }
          40%       { opacity: 1; transform: translate(120px, 240px) scale(0.7); }
          50%       { opacity: 0.9; transform: translate(120px, 240px) scale(1); }
          54%       { opacity: 0; transform: translate(120px, 240px) scale(1.5); }
          100%      { opacity: 0; transform: translate(120px, 240px) scale(0.4); }
        }

        /* ----- Crown placement ----- */
        .koth-crown {
          opacity: 0;
          transform: translate(200px, 60px) scale(0.6);
          animation: koth-crown-place 7s ease-out infinite;
        }
        @keyframes koth-crown-place {
          0%, 60%   { opacity: 0; transform: translate(200px, 55px) scale(0.6); }
          66%       { opacity: 1; transform: translate(200px, 78px) scale(1.35); }
          72%, 100% { opacity: 1; transform: translate(200px, 78px) scale(1.2); }
        }
      `}</style>
    </div>
  );
}

function StickFigure() {
  // Slightly bigger figure (~20w x 42h). Origin at feet (0,0).
  const stroke = "#FFFFFF";
  return (
    <g fill="none" stroke={stroke} strokeWidth="2.5" strokeLinecap="round">
      {/* head */}
      <circle cx="0" cy="-36" r="5.5" fill={stroke} stroke="none" />
      {/* body */}
      <line x1="0" y1="-30" x2="0" y2="-14" />
      {/* arms */}
      <line x1="0" y1="-25" x2="-10" y2="-17" />
      <line x1="0" y1="-25" x2="10" y2="-17" />
      {/* legs */}
      <line x1="0" y1="-14" x2="-7" y2="-1" />
      <line x1="0" y1="-14" x2="7" y2="-1" />
    </g>
  );
}
