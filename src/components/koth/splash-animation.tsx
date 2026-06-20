import { CrownPath } from "./logo-mark";

/**
 * Splash animation:
 *   1. White stick figure runs in from the left.
 *   2. Jumps up to the apex of the hill.
 *   3. Places a white crown on top.
 *   4. Runs off to the right.
 * Hill stays, crown stays, then the cycle loops.
 */
export function SplashAnimation() {
  return (
    <div className="relative mx-auto w-full max-w-[340px]">
      <svg
        viewBox="0 0 400 280"
        className="block h-auto w-full"
        aria-hidden
      >
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

        {/* Crown — fades/snaps in at the apex */}
        <g className="koth-crown" transform="translate(200 75)">
          <CrownPath />
        </g>

        {/* Stick figure */}
        <g className="koth-figure">
          <StickFigure />
        </g>
      </svg>

      <style>{`
        /* Crown sits on the apex; appears when the figure plants it. */
        .koth-crown {
          opacity: 0;
          transform-origin: 200px 90px;
          animation: koth-crown-place 6s ease-out infinite;
        }
        @keyframes koth-crown-place {
          0%, 45%   { opacity: 0; transform: translate(200px, 60px) scale(0.6); }
          50%       { opacity: 1; transform: translate(200px, 75px) scale(1.1); }
          55%, 100% { opacity: 1; transform: translate(200px, 75px) scale(1); }
        }

        /* Figure runs in, jumps, plants crown, runs off. */
        .koth-figure {
          transform: translate(-60px, 210px);
          animation: koth-figure-path 6s ease-in-out infinite;
        }
        @keyframes koth-figure-path {
          0%   { transform: translate(-60px, 210px); }
          25%  { transform: translate(140px, 210px); }   /* arrived at hill base */
          40%  { transform: translate(200px, 80px); }    /* peak of jump (apex) */
          55%  { transform: translate(200px, 80px); }    /* hold while placing */
          70%  { transform: translate(260px, 210px); }   /* down right side */
          100% { transform: translate(460px, 210px); }   /* off-screen right */
        }
      `}</style>
    </div>
  );
}

function StickFigure() {
  // Origin at figure's feet (0,0). White stick figure ~14w × 30h.
  const stroke = "#FFFFFF";
  return (
    <g fill="none" stroke={stroke} strokeWidth="2" strokeLinecap="round">
      {/* head */}
      <circle cx="0" cy="-26" r="4" fill={stroke} stroke="none" />
      {/* body */}
      <line x1="0" y1="-22" x2="0" y2="-10" />
      {/* arms */}
      <line x1="0" y1="-18" x2="-7" y2="-12" />
      <line x1="0" y1="-18" x2="7" y2="-12" />
      {/* legs */}
      <line x1="0" y1="-10" x2="-5" y2="-1" />
      <line x1="0" y1="-10" x2="5" y2="-1" />
    </g>
  );
}
