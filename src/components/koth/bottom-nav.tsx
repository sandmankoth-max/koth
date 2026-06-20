import { Link, useRouterState } from "@tanstack/react-router";
import { Home, Trophy, Video, Users, User } from "lucide-react";
import { cn } from "@/lib/utils";

const items = [
  { to: "/home", icon: Home, label: "Home" },
  { to: "/leaderboard", icon: Trophy, label: "Board" },
  { to: "/record", icon: Video, label: "Record", primary: true as const },
  { to: "/friends", icon: Users, label: "Friends" },
  { to: "/profile", icon: User, label: "Profile" },
];

export function BottomNav() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  return (
    <nav
      aria-label="Primary"
      className="fixed bottom-0 left-0 right-0 z-30 border-t border-border bg-koth-black"
      style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
    >
      <ul className="mx-auto flex max-w-md items-stretch justify-between px-2">
        {items.map(({ to, icon: Icon, label, primary }) => {
          const active = pathname === to || (to !== "/home" && pathname.startsWith(to));
          return (
            <li key={to} className="flex-1">
              <Link
                to={to}
                className={cn(
                  "tap-44 flex flex-col items-center justify-center gap-0.5 py-2 text-[11px] font-semibold text-koth-white/70",
                  active && "text-koth-white",
                )}
              >
                {primary ? (
                  <span className="-mt-5 mb-0.5 inline-flex h-12 w-12 items-center justify-center rounded-full bg-koth-red shadow-[0_0_0_4px_var(--color-koth-black)]">
                    <Icon className="h-6 w-6 text-koth-white" aria-hidden />
                  </span>
                ) : (
                  <Icon className={cn("h-5 w-5", active && "text-koth-red")} aria-hidden />
                )}
                <span className="label-broadcast">{label}</span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
