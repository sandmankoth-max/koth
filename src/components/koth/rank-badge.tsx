import { cn } from "@/lib/utils";

type RankBadgeProps = {
  rank: number;
  size?: "sm" | "md" | "lg";
  className?: string;
};

const sizeMap = {
  sm: "h-7 w-7 text-[13px]",
  md: "h-10 w-10 text-base",
  lg: "h-14 w-14 text-xl",
};

/**
 * Circular rank badge. 1st = koth-red, 2nd = silver, 3rd = bronze, 4+ = koth-black.
 * Number is monospaced — it's a scoreboard digit.
 */
export function RankBadge({ rank, size = "md", className }: RankBadgeProps) {
  const palette =
    rank === 1
      ? "bg-koth-red text-koth-white"
      : rank === 2
        ? "bg-koth-silver text-koth-black"
        : rank === 3
          ? "bg-koth-bronze text-koth-white"
          : "bg-koth-black text-koth-white";
  return (
    <span
      aria-label={`Rank ${rank}`}
      className={cn(
        "mono-stat inline-flex items-center justify-center rounded-full font-bold",
        sizeMap[size],
        palette,
        className,
      )}
    >
      {rank}
    </span>
  );
}
