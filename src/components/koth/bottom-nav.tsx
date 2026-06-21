import { Link, useRouterState } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Home, Trophy, Video, Users, User } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

const items = [
  { to: "/home", icon: Home, label: "Home" },
  { to: "/leaderboard", icon: Trophy, label: "Board" },
  { to: "/record", icon: Video, label: "Record", primary: true as const },
  { to: "/friends", icon: Users, label: "Friends" },
  { to: "/profile", icon: User, label: "Profile" },
];

export function BottomNav() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });

  const { data: activeChallenge } = useQuery({
    queryKey: ["nav-active-challenge"],
    queryFn: async () => {
      const { data } = await supabase
        .from("challenges")
        .select("id")
        .eq("status", "active")
        .limit(1)
        .maybeSingle();
      return data;
    },
    refetchInterval: 60_000,
  });

  const recordingDisabled = !activeChallenge;

  return (
    <nav
      aria-label="Primary"
      className="fixed bottom-0 left-0 right-0 z-30 bg-koth-black"
      style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
    >
      <ul className="mx-auto flex max-w-md items-stretch justify-between px-2">
        {items.map(({ to, icon: Icon, label, primary }) => {
          const active = pathname === to || (to !== "/home" && pathname.startsWith(to));
          const isRecord = to === "/record";
          const disabled = isRecord && recordingDisabled;

          const inner = (
            <>
              {primary ? (
                <span
                  className={cn(
                    "-mt-5 mb-0.5 inline-flex h-12 w-12 items-center justify-center rounded-full shadow-[0_0_0_4px_var(--color-koth-black)]",
                    disabled ? "bg-koth-white/20" : "bg-koth-red",
                  )}
                >
                  <Icon
                    className={cn("h-6 w-6", disabled ? "text-koth-white/50" : "text-koth-white")}
                    aria-hidden
                  />
                </span>
              ) : (
                <Icon className={cn("h-5 w-5", active && "text-koth-red")} aria-hidden />
              )}
              <span className="label-broadcast">{label}</span>
            </>
          );

          const className = cn(
            "tap-44 flex w-full flex-col items-center justify-center gap-0.5 py-2 text-[11px] font-semibold text-koth-white/70",
            active && "text-koth-white",
            disabled && "text-koth-white/40",
          );

          return (
            <li key={to} className="flex-1">
              {disabled ? (
                <button
                  type="button"
                  onClick={() =>
                    toast("No active challenge", {
                      description: "Recording is disabled until the next challenge drops Monday at 10am.",
                    })
                  }
                  aria-disabled
                  className={className}
                >
                  {inner}
                </button>
              ) : (
                <Link to={to} className={className}>
                  {inner}
                </Link>
              )}
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
