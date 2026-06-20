/**
 * KOTH logo mark — a two-tone red hill with a white crown above.
 * Used for the app icon and as the static logo throughout the app.
 */
export function LogoMark({
  size = 96,
  className,
}: {
  size?: number;
  className?: string;
}) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 120 120"
      fill="none"
      className={className}
      aria-label="KOTH logo"
      role="img"
    >
      {/* Crown */}
      <g transform="translate(60 30)">
        <CrownPath />
      </g>
      {/* Hill — split down the middle into two close reds */}
      <polygon points="60,55 15,108 60,108" fill="#E8262B" />
      <polygon points="60,55 105,108 60,108" fill="#B81F23" />
    </svg>
  );
}

export function CrownPath({ fill = "#FFFFFF" }: { fill?: string }) {
  // Crown centered at (0,0), ~36 wide × 20 tall, baseline at y=10
  return (
    <g>
      <path
        d="M -18 10
           L -18 -2
           L -10 6
           L 0 -10
           L 10 6
           L 18 -2
           L 18 10 Z"
        fill={fill}
      />
      {/* Jewels */}
      <circle cx="-12" cy="-3" r="1.8" fill={fill} />
      <circle cx="0" cy="-12" r="2" fill={fill} />
      <circle cx="12" cy="-3" r="1.8" fill={fill} />
    </g>
  );
}
