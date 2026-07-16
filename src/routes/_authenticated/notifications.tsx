import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { formatDistanceToNow } from "date-fns";
import { Bell, Crown, ArrowDown, Flag, UserPlus, UserCheck, Check, X, Heart, MessageCircle, AtSign, Megaphone, ShieldAlert, BadgeCheck, Trophy } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/notifications")({
  head: () => ({ meta: [{ title: "Notifications | KOTH" }] }),
  component: Notifications,
});

const iconFor = (t: string) =>
  t === "podium_gained" ? <Crown className="h-5 w-5 text-koth-red" /> :
  t === "podium_lost" ? <ArrowDown className="h-5 w-5 text-koth-red" /> :
  t === "deadline_reminder" || t === "deadline_reminder_24h" ? <Flag className="h-5 w-5 text-koth-pr-text" /> :
  t === "friend_request" ? <UserPlus className="h-5 w-5 text-koth-red" /> :
  t === "friend_accepted" ? <UserCheck className="h-5 w-5 text-koth-red" /> :
  t === "like_video" || t === "like_comment" ? <Heart className="h-5 w-5 text-koth-red" fill="currentColor" /> :
  t === "comment_video" || t === "reply_comment" || t === "reply_challenge_comment" ? <MessageCircle className="h-5 w-5 text-koth-red" /> :
  t === "tag_comment" || t === "tag_challenge_comment" ? <AtSign className="h-5 w-5 text-koth-red" /> :
  t === "admin_message" ? <Megaphone className="h-5 w-5 text-koth-red" /> :
  t === "time_verified" ? <BadgeCheck className="h-5 w-5 text-koth-pr-text" /> :
  t === "time_disqualified" ? <ShieldAlert className="h-5 w-5 text-koth-red" /> :
  t === "challenge_closed" ? <Trophy className="h-5 w-5 text-koth-pr-text" /> :
  <Bell className="h-5 w-5 text-foreground" />;

const preview = (s?: string) => (s ? `: "${s.length > 60 ? s.slice(0, 60) + "…" : s}"` : "");

const labelFor = (n: any) => {
  const u = n.payload?.from_username ? `@${n.payload.from_username}` : "Someone";
  switch (n.type) {
    case "new_challenge":
      return `New challenge is live: ${n.payload?.title ?? "this week's challenge"}`;
    case "challenge_closed":
      return `Challenge closed — ${n.payload?.title ?? "this week's challenge"}. New one drops Monday at 10am.`;
    case "deadline_reminder_24h":
      return `1 day left to submit — ${n.payload?.title ?? "today's challenge"}`;
    case "deadline_reminder":
      return `1 hour left to submit — ${n.payload?.title ?? "today's challenge closes soon"}`;
    case "podium_lost":
      return `You were kicked off the podium${n.payload?.overtaken_by_username ? ` by @${n.payload.overtaken_by_username}` : ""}`;
    case "podium_gained":
      return `You're on the podium — #${n.payload?.new_rank}`;
    case "time_verified":
      return `Your entry was verified${n.payload?.value != null ? ` — ${n.payload.value}` : ""}`;
    case "time_disqualified":
      return n.payload?.reason
        ? `Your submission was rejected — ${n.payload.reason}`
        : `Your submission was rejected`;
    case "friend_request":
      return `${u} sent you a friend request`;
    case "friend_accepted":
      return `${u} accepted your friend request`;
    case "like_video":
      return `${u} liked your video`;
    case "like_comment":
      return `${u} liked your comment`;
    case "comment_video":
      return `${u} commented on your video${preview(n.payload?.preview)}`;
    case "reply_comment":
      return `${u} replied to your comment${preview(n.payload?.preview)}`;
    case "reply_challenge_comment":
      return `${u} replied to your challenge comment${preview(n.payload?.preview)}`;
    case "tag_comment":
      return `${u} mentioned you in a video comment${preview(n.payload?.preview)}`;
    case "tag_challenge_comment":
      return `${u} mentioned you in a challenge comment${preview(n.payload?.preview)}`;
    case "admin_message":
      return n.payload?.message ?? "Message from admin";
    case "winners_announcement":
      return `Winners announced — 1st @${n.payload?.first_username} ($${Number(n.payload?.first_amount ?? 0)}), 2nd @${n.payload?.second_username} ($${Number(n.payload?.second_amount ?? 0)}), 3rd @${n.payload?.third_username} ($${Number(n.payload?.third_amount ?? 0)})`;
    default:
      return "Notification";
  }
};

function Notifications() {
  const { user } = useAuth();
  const [items, setItems] = useState<any[]>([]);
  const [busy, setBusy] = useState<string | null>(null);

  async function load() {
    if (!user) return;
    const { data } = await supabase
      .from("notifications")
      .select("*")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(100);
    setItems(data ?? []);
  }

  useEffect(() => {
    if (!user) return;
    let active = true;
    (async () => {
      const { data } = await supabase
        .from("notifications")
        .select("*")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false })
        .limit(100);
      const list = data ?? [];

      // Resolve friend_request notifications against current friendship state
      const fids = Array.from(new Set(
        list.filter((n: any) => n.type === "friend_request" && n.payload?.friendship_id)
          .map((n: any) => n.payload.friendship_id as string)
      ));
      let statusByFid = new Map<string, string>();
      if (fids.length) {
        const { data: fs } = await supabase.from("friendships").select("id, status").in("id", fids);
        statusByFid = new Map((fs ?? []).map((f: any) => [f.id, f.status]));
      }
      const resolved = list.map((n: any) => {
        if (n.type !== "friend_request") return n;
        const fid = n.payload?.friendship_id;
        if (!fid) return n;
        const st = statusByFid.get(fid);
        if (!st) return { ...n, _resolved: "rejected" };
        if (st === "accepted") return { ...n, _resolved: "accepted" };
        if (st !== "pending") return { ...n, _resolved: "rejected" };
        return n;
      });

      if (active) setItems(resolved);
      await supabase
        .from("notifications")
        .update({ read: true })
        .eq("user_id", user.id)
        .eq("read", false);
    })();
    return () => { active = false; };
  }, [user]);


  async function accept(n: any) {
    const fid = n.payload?.friendship_id;
    if (!fid) { toast.error("Invalid request"); return; }
    setBusy(n.id);
    const { error } = await supabase.from("friendships").update({ status: "accepted" }).eq("id", fid);
    setBusy(null);
    if (error) toast.error(error.message);
    else {
      toast.success(`You and @${n.payload?.from_username} are now friends`);
      setItems((cur) => cur.map((x) => x.id === n.id ? { ...x, _resolved: "accepted" } : x));
    }
  }

  async function reject(n: any) {
    const fid = n.payload?.friendship_id;
    if (!fid) { toast.error("Invalid request"); return; }
    setBusy(n.id);
    const { error } = await supabase.from("friendships").delete().eq("id", fid);
    setBusy(null);
    if (error) toast.error(error.message);
    else {
      setItems((cur) => cur.map((x) => x.id === n.id ? { ...x, _resolved: "rejected" } : x));
    }
  }

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
                  {n.type === "friend_request" && !n._resolved && (
                    <div className="mt-2 flex gap-2">
                      <button
                        onClick={() => accept(n)}
                        disabled={busy === n.id}
                        className="tap-44 inline-flex items-center gap-1 rounded-full bg-koth-red px-3 py-1.5 text-xs font-bold text-koth-white disabled:opacity-50"
                      >
                        <Check className="h-3.5 w-3.5" /> Accept
                      </button>
                      <button
                        onClick={() => reject(n)}
                        disabled={busy === n.id}
                        className="tap-44 inline-flex items-center gap-1 rounded-full border border-border px-3 py-1.5 text-xs font-bold text-muted-foreground disabled:opacity-50"
                      >
                        <X className="h-3.5 w-3.5" /> Decline
                      </button>
                    </div>
                  )}
                  {n._resolved === "accepted" && (
                    <p className="mt-1 text-[11px] font-semibold text-koth-red">Accepted ✓</p>
                  )}
                  {n._resolved === "rejected" && (
                    <p className="mt-1 text-[11px] text-muted-foreground">Declined</p>
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
