import { useEffect, useState } from "react";
import { Clock } from "lucide-react";
import { cn } from "@/lib/utils";
import { countdownParts } from "@/lib/koth-utils";

type Props = {
  target: Date | string;
  variant?: "urgent" | "neutral";
  className?: string;
};

/** Pill-shaped live countdown. Urgent variant pulses red. */
export function Countdown({ target, variant = "urgent", className }: Props) {
  const [parts, setParts] = useState(() => countdownParts(target));
  useEffect(() => {
    const id = setInterval(() => setParts(countdownParts(target)), 1000);
    return () => clearInterval(id);
  }, [target]);

  const label = parts.expired
    ? "Closed"
    : parts.days > 0
      ? `${parts.days}d ${parts.hours}h ${parts.minutes}m`
      : `${String(parts.hours).padStart(2, "0")}:${String(parts.minutes).padStart(2, "0")}:${String(parts.seconds).padStart(2, "0")}`;

  return (
    <span
      className={cn(
        "pill mono-stat whitespace-nowrap",
        variant === "urgent" && !parts.expired
          ? "bg-koth-red text-koth-white"
          : "bg-koth-black text-koth-white",
        className,
      )}
    >
      <Clock className="h-3.5 w-3.5" aria-hidden />
      {label}
    </span>
  );
}
