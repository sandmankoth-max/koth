import { Link, useRouterState } from "@tanstack/react-router";
import { Bell, HelpCircle, Shield } from "lucide-react";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { cn } from "@/lib/utils";
import { LogoMark } from "@/components/koth/logo-mark";

export function TopBar() {
  const { user, isAdmin } = useAuth();
  const [unread, setUnread] = useState(0);
  const [showHelp, setShowHelp] = useState(false);
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
    <>
      <header className="sticky top-0 z-20 border-b border-border bg-koth-black/95 backdrop-blur">
        <div className="mx-auto flex max-w-md items-center justify-between px-4 py-3">
          <Link to="/home" className="flex items-center gap-2" aria-label="KOTH home">
            <LogoMark size={32} className="shrink-0" />
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
            <button
              aria-label="Help"
              onClick={() => setShowHelp(true)}
              className="tap-44 relative inline-flex items-center justify-center rounded-full p-2 text-koth-white/80 hover:text-koth-white"
            >
              <HelpCircle className="h-5 w-5" aria-hidden />
            </button>
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
      {showHelp && (
        <div
          onClick={() => setShowHelp(false)}
          className="fixed inset-0 z-[60] flex items-center justify-center bg-black/70"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-[16rem] rounded-2xl border border-border bg-card p-5 text-center shadow-2xl"
          >
            <HelpCircle className="mx-auto mb-2 h-6 w-6 text-koth-red" />
            <h3 className="text-base font-bold text-koth-white">Need help?</h3>
            <p className="mt-1.5 text-xs text-muted-foreground">
              For support questions or business contact:
            </p>
            <p className="mt-1 text-xs font-semibold text-koth-red">sandmankoth@gmail.com</p>
            <button
              onClick={() => setShowHelp(false)}
              className="mt-4 inline-flex h-9 items-center justify-center rounded-full bg-koth-red px-5 text-xs font-semibold text-koth-white"
            >
              Got it
            </button>
          </div>
        </div>
      )}
    </>
  );
}
