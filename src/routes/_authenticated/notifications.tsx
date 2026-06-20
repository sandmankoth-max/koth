import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { formatDistanceToNow } from "date-fns";
import { Bell, Crown, ArrowDown, ArrowUp, Flag, UserPlus, UserCheck } from "lucide-react";

export const Route = createFileRoute("/_authenticated/notifications")({
  head: () => ({ meta: [{ title: "Notifications — KOTH" }] }),
  component: Notifications,
});

const iconFor = (t: string) =>
  t === "podium_gained" ? <Crown className="h-5 w-5 text-koth-red" /> :
  t === "podium_lost" ? <ArrowDown className="h-5 w-5 text-koth-red" /> :
  t === "overtaken" ? <ArrowUp className="h-5 w-5 text-koth-steel" /> :
  t === "deadline_reminder" || t === "deadline_reminder_24h" ? <Flag className="h-5 w-5 text-koth-pr-text" /> :
  t === "friend_request" ? <UserPlus className="h-5 w-5 text-koth-red" /> :
  t === "friend_accepted" ? <UserCheck className="h-5 w-5 text-koth-red" /> :
  <Bell className="h-5 w-5 text-foreground" />;

const labelFor = (n: any) => {
  switch (n.type) {
    case "new_challenge":
      return `New challenge is live: ${n.payload?.title ?? "this week's challenge"}`;
    case "deadline_reminder_24h":
      return `1 day left to submit — ${n.payload?.title ?? "today's challenge"}`;
    case "deadline_reminder":
      return `1 hour left to submit — ${n.payload?.title ?? "today's challenge closes soon"}`;
    case "overtaken":
      return `@${n.payload?.overtaken_by_username} passed you — you're #${n.payload?.new_rank}`;
    case "podium_lost":
      return `@${n.payload?.overtaken_by_username} knocked you off the podium`;
    case "podium_gained":
      return `You're on the podium — #${n.payload?.new_rank}`;
    case "time_verified":
      return `Your time was verified${n.payload?.value != null ? ` — ${n.payload.value}` : ""}`;
    case "time_disqualified":
      return `Your submission was disqualified`;
    case "friend_request":
      return `@${n.payload?.from_username ?? "someone"} sent you a friend request`;
    case "friend_accepted":
      return `@${n.payload?.from_username ?? "someone"} accepted your friend request`;
    case "admin_message":
      return n.payload?.message ?? "Message from admin";
    default:
      return "Notification";
  }
};

function Notifications() {
  const { user } = useAuth();
  const [items, setItems] = useState<any[]>([]);

  useEffect(() => {
    if (!user) return;
    let active = true;
    async function load() {
      const { data } = await supabase
        .from("notifications")
        .select("*")
        .eq("user_id", user!.id)
        .order("created_at", { ascending: false })
        .limit(100);
      if (active) setItems(data ?? []);
      // mark all read on open
      await supabase
        .from("notifications")
        .update({ read: true })
        .eq("user_id", user!.id)
        .eq("read", false);
    }
    load();
    return () => {
      active = false;
    };
  }, [user]);

  return (
    <div className="space-y-4">
      <section className="koth-stripe overflow-hidden rounded-3xl bg-koth-black p-5 text-koth-white">
        <p className="label-broadcast text-koth-white/60">Activity</p>
        <h1 className="mt-1 text-xl font-bold">Notifications</h1>
      </section>

      <section className="rounded-3xl border border-border bg-card">
        {items.length === 0 ? (
          <div className="p-8 text-center text-sm text-muted-foreground">
            No activity yet. Make a move and the board will start lighting up.
          </div>
        ) : (
          <ul className="divide-y divide-border">
            {items.map((n) => (
              <li key={n.id} className="flex items-start gap-3 px-4 py-3">
                <span className="mt-0.5 inline-flex h-9 w-9 items-center justify-center rounded-full bg-muted">
                  {iconFor(n.type)}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-sm text-foreground">{labelFor(n)}</p>
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    {formatDistanceToNow(new Date(n.created_at), { addSuffix: true })}
                  </p>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
