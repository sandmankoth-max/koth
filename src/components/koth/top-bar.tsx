import { Link, useRouterState } from "@tanstack/react-router";
import { Bell, Shield } from "lucide-react";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { cn } from "@/lib/utils";
import { LogoMark } from "@/components/koth/logo-mark";

export function TopBar() {
  const { user, isAdmin } = useAuth();
  const [unread, setUnread] = useState(0);
  const pathname = useRouterState({ select: (s) => s.location.pathname });

  useEffect(() => {
    if (!user) return;
    let active = true;
    const load = async () => {
      const { count } = await supabase
        .from("notifications")
        .select("*", { count: "exact", head: true })
        .eq("user_id", user.id)
        .eq("read", false);
      if (active) setUnread(count ?? 0);
    };
    load();
    const ch = supabase
      .channel("notif-count")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "notifications", filter: `user_id=eq.${user.id}` },
        load,
      )
      .subscribe();
    return () => {
      active = false;
      supabase.removeChannel(ch);
    };
  }, [user, pathname]);

  return (
    <header className="sticky top-0 z-20 border-b border-border bg-koth-black/95 backdrop-blur">
      <div className="mx-auto flex max-w-md items-center justify-between px-4 py-3">
        <Link to="/home" className="flex items-center gap-2">
          <span className="koth-stripe inline-flex h-8 w-8 items-center justify-center rounded-lg bg-koth-red">
            <span className="mono-stat text-sm font-bold text-koth-white">K</span>
          </span>
          <span className="label-broadcast text-koth-white tracking-[0.12em]">KOTH</span>
        </Link>
        <div className="flex items-center gap-1.5">
          {isAdmin && (
            <Link
              to="/admin"
              aria-label="Admin"
              className={cn(
                "tap-44 inline-flex items-center justify-center rounded-full p-2 text-koth-white/80 hover:text-koth-white",
                pathname.startsWith("/admin") && "text-koth-red",
              )}
            >
              <Shield className="h-5 w-5" aria-hidden />
            </Link>
          )}
          <Link
            to="/notifications"
            aria-label="Notifications"
            className="tap-44 relative inline-flex items-center justify-center rounded-full p-2 text-koth-white/80 hover:text-koth-white"
          >
            <Bell className="h-5 w-5" aria-hidden />
            {unread > 0 && (
              <span className="mono-stat absolute right-1 top-1 inline-flex h-4 min-w-4 items-center justify-center rounded-full bg-koth-red px-1 text-[10px] font-bold text-koth-white">
                {unread > 9 ? "9+" : unread}
              </span>
            )}
          </Link>
        </div>
      </div>
    </header>
  );
}
