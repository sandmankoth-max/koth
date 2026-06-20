import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { Avatar } from "@/components/koth/avatar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Check, UserPlus, X, Users, Heart, MessageCircle, Share2, Play, Crown,
} from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { formatValue, getVideoSignedUrl } from "@/lib/koth-utils";
import { CommentDrawer } from "@/components/koth/comment-drawer";
import { RankBadge } from "@/components/koth/rank-badge";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";

export const Route = createFileRoute("/_authenticated/friends")({
  head: () => ({ meta: [{ title: "Friends — KOTH" }] }),
  component: Friends,
});

type Tab = "feed" | "add";

function Friends() {
  const [tab, setTab] = useState<Tab>("feed");

  if (tab === "feed") {
    // Fullscreen TikTok-style: feed renders its own chrome (floating tabs +
    // podium button) so it can fill the space between top bar and bottom nav.
    return <FeedTab tab={tab} setTab={setTab} onAdd={() => setTab("add")} />;
  }

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 gap-2 rounded-full border border-border bg-card p-1">
        <button
          onClick={() => setTab("feed")}
          className={cn(
            "tap-44 rounded-full py-2 text-sm font-bold transition-colors",
            "text-muted-foreground",
          )}
        >
          Friends Feed
        </button>
        <button
          onClick={() => setTab("add")}
          className={cn(
            "tap-44 rounded-full py-2 text-sm font-bold transition-colors",
            "bg-koth-red text-koth-white",
          )}
        >
          Add Friends
        </button>
      </div>

      <AddTab />
    </div>
  );
}

function FeedTab({ tab, setTab, onAdd }: { tab: Tab; setTab: (t: Tab) => void; onAdd: () => void }) {
  const { user } = useAuth();

  const challengeQ = useQuery({
    queryKey: ["active-challenge"],
    queryFn: async () => {
      const { data } = await supabase
        .from("challenges")
        .select("*")
        .eq("status", "active")
        .order("starts_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      return data;
    },
  });

  const friendsQ = useQuery({
    queryKey: ["friends", user?.id],
    enabled: !!user?.id,
    queryFn: async () => {
      const { data } = await supabase
        .from("friendships")
        .select("requester_id, addressee_id")
        .eq("status", "accepted")
        .or(`requester_id.eq.${user!.id},addressee_id.eq.${user!.id}`);
      return (data ?? []).map((f) => (f.requester_id === user!.id ? f.addressee_id : f.requester_id));
    },
  });

  // Include the user themselves so their own friends-only submissions show.
  const visibleUserIds = [...(friendsQ.data ?? []), ...(user ? [user.id] : [])];

  const feedQ = useQuery({
    queryKey: ["feed", challengeQ.data?.id, visibleUserIds.sort().join(",")],
    enabled: !!challengeQ.data && visibleUserIds.length > 0,
    queryFn: async () => {
      const { data } = await supabase
        .from("submissions")
        .select(
          "id, user_id, self_reported_value, admin_verified_value, video_path, submitted_at, visibility, profiles!submissions_user_id_fkey(username, display_name, avatar_url)",
        )
        .eq("challenge_id", challengeQ.data!.id)
        .neq("status", "disqualified")
        .in("user_id", visibleUserIds)
        .order("submitted_at", { ascending: false });
      return data ?? [];
    },
  });

  const c = challengeQ.data;
  const noFriends = friendsQ.data && friendsQ.data.length === 0;

  // Friends podium: best entry per user (across all visibility levels).
  const podium = (() => {
    const rows = feedQ.data ?? [];
    const byUser = new Map<string, any>();
    for (const r of rows) {
      const val = Number(r.admin_verified_value ?? r.self_reported_value);
      const prev = byUser.get(r.user_id);
      if (!prev || val > prev.val) byUser.set(r.user_id, { ...r, val });
    }
    return Array.from(byUser.values()).sort((a, b) => b.val - a.val).slice(0, 3);
  })();

  const [podiumOpen, setPodiumOpen] = useState(false);
  const hasFeed = !!c && (feedQ.data?.length ?? 0) > 0;

  if (!hasFeed) {
    return (
      <div className="space-y-4">
        <div className="grid grid-cols-2 gap-2 rounded-full border border-border bg-card p-1">
          <button className="tap-44 rounded-full bg-koth-red py-2 text-sm font-bold text-koth-white">
            Friends Feed
          </button>
          <button
            onClick={() => setTab("add")}
            className="tap-44 rounded-full py-2 text-sm font-bold text-muted-foreground"
          >
            Add Friends
          </button>
        </div>

        <section className="koth-stripe overflow-hidden rounded-3xl bg-koth-black p-4 text-koth-white">
          <p className="label-broadcast text-koth-white/60">Friends feed</p>
          <h1 className="mt-0.5 text-lg font-bold">{c?.title ?? "No active challenge"}</h1>
        </section>

        {noFriends ? (
          <div className="rounded-3xl border border-dashed border-border bg-card p-8 text-center">
            <Users className="mx-auto h-8 w-8 text-koth-red" aria-hidden />
            <p className="mt-3 text-base font-bold text-foreground">No friends yet</p>
            <p className="mt-1 text-sm text-muted-foreground">
              Add competitors and track their progress through every challenge.
            </p>
            <button
              onClick={onAdd}
              className="tap-44 mt-4 inline-flex items-center rounded-full bg-koth-red px-4 py-2 text-sm font-bold text-koth-white"
            >
              <UserPlus className="mr-2 h-4 w-4" aria-hidden /> Find friends
            </button>
          </div>
        ) : (
          <div className="rounded-3xl border border-dashed border-border bg-card p-8 text-center text-sm text-muted-foreground">
            No videos yet from your friends in this challenge.
          </div>
        )}
      </div>
    );
  }

  return (
    <>
      {/* Fullscreen TikTok-style scroller — escapes the padded shell. */}
      <FeedScroller rows={feedQ.data!} c={c!} />

      {/* Floating tab switcher */}
      <div className="fixed left-1/2 top-16 z-40 -translate-x-1/2">
        <div className="flex items-center gap-1 rounded-full bg-black/50 p-1 backdrop-blur">
          <button
            onClick={() => {}}
            className="tap-44 rounded-full bg-koth-red px-4 py-1.5 text-xs font-bold text-koth-white"
          >
            Feed
          </button>
          <button
            onClick={() => setTab("add")}
            className="tap-44 rounded-full px-4 py-1.5 text-xs font-bold text-white/80"
          >
            Add
          </button>
        </div>
      </div>

      {/* Floating podium button */}
      {podium.length > 0 && (
        <button
          onClick={() => setPodiumOpen(true)}
          className="tap-44 fixed right-3 top-16 z-40 inline-flex items-center gap-1.5 rounded-full bg-black/60 px-3 py-2 text-xs font-bold text-white backdrop-blur"
        >
          <Crown className="h-4 w-4 text-koth-red" aria-hidden /> Podium
        </button>
      )}

      <PodiumDialog
        open={podiumOpen}
        onOpenChange={setPodiumOpen}
        podium={podium}
        c={c!}
      />
    </>
  );
}

function PodiumDialog({
  open,
  onOpenChange,
  podium,
  c,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  podium: any[];
  c: any;
}) {
  // Lazy import to avoid restructuring imports.
  
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm">
        <DialogTitle>Friends podium</DialogTitle>
        <p className="text-xs text-muted-foreground">
          Best time per friend for <span className="font-semibold text-foreground">{c.title}</span>.
        </p>
        <FriendsPodium podium={podium} c={c} />
      </DialogContent>
    </Dialog>
  );
}

function FriendsPodium({ podium, c }: { podium: any[]; c: any }) {
  return (
    <section className="rounded-3xl border border-border bg-card p-3">
      <p className="label-broadcast mb-2 px-1 text-muted-foreground">Friends podium</p>
      <div className="grid grid-cols-3 items-end gap-2 pt-5">
        {[1, 0, 2].map((pos) => {
          const r = podium[pos];
          const rank = pos + 1;
          const heights = ["h-32", "h-28", "h-24"];
          const isFirst = rank === 1;
          const tile = isFirst
            ? "bg-gradient-to-b from-koth-red to-[color-mix(in_oklab,var(--color-koth-red)_70%,black)] text-koth-white"
            : rank === 2
              ? "bg-koth-silver text-koth-black"
              : "bg-koth-bronze text-koth-white";
          const orderCls = pos === 1 ? "order-1" : pos === 0 ? "order-2" : "order-3";
          if (!r) {
            return (
              <div
                key={rank}
                className={`${orderCls} ${heights[pos]} flex flex-col items-center justify-end rounded-2xl border border-dashed border-border bg-card p-2`}
              >
                <RankBadge rank={rank} size="sm" />
                <p className="mt-1 text-[10px] text-muted-foreground">Open</p>
              </div>
            );
          }
          const p = r.profiles;
          return (
            <div key={r.id} className={`${orderCls} relative flex flex-col items-center`}>
              {isFirst && (
                <Crown
                  className="absolute -top-5 left-1/2 z-10 h-6 w-6 -translate-x-1/2 fill-koth-red text-koth-red drop-shadow"
                  aria-hidden
                />
              )}
              <div
                className={`${heights[pos]} flex w-full flex-col items-center justify-between rounded-2xl px-1.5 pb-2 pt-3 text-center shadow ${tile}`}
              >
                <Avatar
                  name={p?.display_name ?? p?.username ?? "?"}
                  avatarPath={p?.avatar_url}
                  size={isFirst ? 38 : 32}
                />
                <div className="min-w-0 w-full">
                  <p className="w-full truncate text-[10px] font-semibold opacity-90">
                    @{p?.username}
                  </p>
                  <p className="mono-stat w-full truncate text-sm font-bold leading-tight">
                    {formatValue(r.val, c.unit_type, c.unit_label)}
                  </p>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}

function FeedScroller({ rows, c }: { rows: any[]; c: any }) {
  // Fixed overlay between top bar (~56px) and bottom nav (~64px). The IO
  // root is the scroller itself so autoplay decisions don't depend on
  // viewport scroll position.
  const scrollerRef = useRef<HTMLDivElement>(null);
  return (
    <div
      ref={scrollerRef}
      className="fixed inset-x-0 top-14 bottom-16 z-20 snap-y snap-mandatory overflow-y-auto overscroll-y-contain bg-black"
      style={{
        scrollSnapType: "y mandatory",
        WebkitOverflowScrolling: "touch",
        scrollbarWidth: "none",
      }}
    >
      {rows.map((r) => (
        <FeedVideo key={r.id} row={r} c={c} scrollRoot={scrollerRef} />
      ))}
    </div>
  );
}

function FeedVideo({ row, c, scrollRoot }: { row: any; c: any; scrollRoot: React.RefObject<HTMLDivElement | null> }) {
  const { user } = useAuth();
  const qc = useQueryClient();
  const videoRef = useRef<HTMLVideoElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [url, setUrl] = useState<string | null>(null);
  const [visible, setVisible] = useState(false);
  const [paused, setPaused] = useState(false);
  const [commentsOpen, setCommentsOpen] = useState(false);
  const [burst, setBurst] = useState(false);
  const lastTap = useRef(0);
  const p = row.profiles;
  const val = Number(row.admin_verified_value ?? row.self_reported_value);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const io = new IntersectionObserver(
      (entries) => entries.forEach((e) => setVisible(e.intersectionRatio > 0.6)),
      { root: scrollRoot.current, threshold: [0, 0.6, 1] },
    );
    io.observe(el);
    return () => io.disconnect();
  }, [scrollRoot]);

  useEffect(() => {
    if (!visible || url) return;
    let active = true;
    getVideoSignedUrl(row.video_path).then((u) => active && setUrl(u));
    return () => { active = false; };
  }, [visible, url, row.video_path]);

  useEffect(() => {
    const v = videoRef.current;
    if (!v) return;
    if (visible && !paused) v.play().catch(() => {});
    else v.pause();
  }, [visible, paused, url]);

  const likeQ = useQuery({
    queryKey: ["video-likes", row.id],
    queryFn: async () => {
      const [{ count }, mine] = await Promise.all([
        supabase.from("video_likes").select("*", { count: "exact", head: true }).eq("submission_id", row.id),
        user
          ? supabase
              .from("video_likes").select("submission_id")
              .eq("submission_id", row.id).eq("user_id", user.id).maybeSingle()
          : Promise.resolve({ data: null } as any),
      ]);
      return { count: count ?? 0, liked: !!mine.data };
    },
  });
  const commentCountQ = useQuery({
    queryKey: ["video-comment-count", row.id],
    queryFn: async () => {
      const { count } = await supabase
        .from("video_comments").select("*", { count: "exact", head: true }).eq("submission_id", row.id);
      return count ?? 0;
    },
  });

  async function toggleLike() {
    if (!user) { toast.error("Sign in to like"); return; }
    const liked = likeQ.data?.liked;
    qc.setQueryData(["video-likes", row.id], (old: any) => ({
      count: (old?.count ?? 0) + (liked ? -1 : 1),
      liked: !liked,
    }));
    if (liked) {
      await supabase.from("video_likes").delete().eq("submission_id", row.id).eq("user_id", user.id);
    } else {
      await supabase.from("video_likes").insert({ submission_id: row.id, user_id: user.id });
    }
    qc.invalidateQueries({ queryKey: ["video-likes", row.id] });
  }

  function handleTap() {
    const now = Date.now();
    if (now - lastTap.current < 300) {
      if (!likeQ.data?.liked) toggleLike();
      setBurst(true);
      window.setTimeout(() => setBurst(false), 700);
      lastTap.current = 0;
      return;
    }
    lastTap.current = now;
    setPaused((p) => !p);
  }

  return (
    <div
      ref={containerRef}
      className="relative w-full snap-start snap-always bg-black"
      style={{
        height: "calc(100dvh - 120px)",
        minHeight: "calc(100dvh - 120px)",
        scrollSnapStop: "always",
      }}
    >
      <button
        type="button"
        onClick={handleTap}
        className="absolute inset-0 z-0 flex items-center justify-center"
        aria-label="Tap to pause or play"
      >
        {url ? (
          <video
            ref={videoRef}
            src={url}
            loop
            playsInline
            muted={false}
            className="h-full w-full object-contain"
          />
        ) : (
          <div className="h-full w-full animate-pulse bg-neutral-900" />
        )}
        {paused && (
          <span className="pointer-events-none absolute inset-0 z-10 flex items-center justify-center">
            <span className="inline-flex h-16 w-16 items-center justify-center rounded-full bg-black/40 backdrop-blur">
              <Play className="h-8 w-8 text-white" />
            </span>
          </span>
        )}
        {burst && (
          <Heart
            className="pointer-events-none absolute z-20 h-32 w-32 animate-ping text-koth-red"
            fill="currentColor"
          />
        )}
      </button>

      {/* Bottom-left info */}
      <div className="absolute bottom-4 left-4 right-20 z-20 text-white">
        <Link
          to="/u/$username"
          params={{ username: p?.username ?? "user" }}
          onClick={(e) => e.stopPropagation()}
          className="text-base font-bold"
        >
          @{p?.username}
        </Link>
        <p className="mt-1 text-xs text-white/80">
          <span className="rounded-full bg-koth-red px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider">
            {c.title}
          </span>
          <span className="ml-2 mono-stat font-bold">
            {formatValue(val, c.unit_type, c.unit_label)}
          </span>
          {row.visibility === "friends_only" && (
            <span className="ml-2 rounded-full bg-white/20 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider">
              Friends
            </span>
          )}
        </p>
      </div>

      {/* Right action rail */}
      <div className="absolute right-2 top-1/2 z-20 flex -translate-y-1/2 flex-col items-center gap-5 text-white">
        <Link
          to="/u/$username"
          params={{ username: p?.username ?? "user" }}
          onClick={(e) => e.stopPropagation()}
          className="tap-44 inline-flex items-center justify-center rounded-full ring-2 ring-koth-red"
          aria-label={`Open @${p?.username}'s profile`}
        >
          <Avatar
            name={p?.display_name ?? p?.username ?? "?"}
            avatarPath={p?.avatar_url}
            size={42}
          />
        </Link>
        <Rail
          onClick={toggleLike}
          icon={
            <Heart
              strokeWidth={2.5}
              className={cn(
                "h-8 w-8 drop-shadow-[0_2px_3px_rgba(0,0,0,0.6)]",
                likeQ.data?.liked ? "fill-koth-red text-koth-red" : "fill-white text-white",
              )}
            />
          }
          count={likeQ.data?.count ?? 0}
        />
        <Rail
          onClick={() => setCommentsOpen(true)}
          icon={
            <MessageCircle
              strokeWidth={2.5}
              className="h-8 w-8 text-white drop-shadow-[0_2px_3px_rgba(0,0,0,0.6)]"
            />
          }
          count={commentCountQ.data ?? 0}
        />
        <Rail
          onClick={() => toast.message("Sharing coming soon")}
          icon={
            <Share2
              strokeWidth={2.5}
              className="h-8 w-8 text-white drop-shadow-[0_2px_3px_rgba(0,0,0,0.6)]"
            />
          }
          count={0}
        />
      </div>

      <CommentDrawer
        kind="video"
        targetId={row.id}
        ownerId={row.user_id}
        open={commentsOpen}
        onOpenChange={setCommentsOpen}
      />
    </div>
  );
}

function Rail({ onClick, icon, count }: { onClick: () => void; icon: React.ReactNode; count: number }) {
  return (
    <button
      onClick={(e) => { e.stopPropagation(); onClick(); }}
      className="tap-44 flex flex-col items-center gap-0.5"
    >
      {icon}
      <span className="mono-stat text-[11px] font-bold leading-none">
        {count < 1000 ? count : `${(count / 1000).toFixed(1).replace(/\.0$/, "")}K`}
      </span>
    </button>
  );
}

function AddTab() {
  const { user } = useAuth();
  const [q, setQ] = useState("");
  const [results, setResults] = useState<any[]>([]);
  const [incoming, setIncoming] = useState<any[]>([]);
  const [outgoing, setOutgoing] = useState<any[]>([]);
  const [accepted, setAccepted] = useState<any[]>([]);

  async function reload() {
    if (!user) return;
    const { data: rels } = await supabase
      .from("friendships")
      .select(
        "id, status, requester_id, addressee_id, req:profiles!friendships_requester_id_fkey(username, display_name, avatar_url), addr:profiles!friendships_addressee_id_fkey(username, display_name, avatar_url)",
      )
      .or(`requester_id.eq.${user.id},addressee_id.eq.${user.id}`);
    const all = (rels as any[] | null) ?? [];
    setIncoming(all.filter((r) => r.status === "pending" && r.addressee_id === user.id));
    setOutgoing(all.filter((r) => r.status === "pending" && r.requester_id === user.id));
    setAccepted(all.filter((r) => r.status === "accepted"));
  }

  useEffect(() => {
    reload();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id]);

  useEffect(() => {
    if (!q || q.length < 2 || !user) {
      setResults([]);
      return;
    }
    const t = setTimeout(async () => {
      const { data } = await supabase
        .from("profiles")
        .select("id, username, display_name, avatar_url")
        .ilike("username", `%${q.toLowerCase()}%`)
        .neq("id", user.id)
        .limit(10);
      setResults(data ?? []);
    }, 200);
    return () => clearTimeout(t);
  }, [q, user]);

  async function send(addressee_id: string) {
    if (!user) return;
    const { error } = await supabase
      .from("friendships")
      .insert({ requester_id: user.id, addressee_id, status: "pending" });
    if (error) toast.error(error.message);
    else {
      toast.success("Friend request sent");
      reload();
    }
  }

  async function accept(id: string) {
    await supabase.from("friendships").update({ status: "accepted" }).eq("id", id);
    reload();
  }

  async function remove(id: string) {
    await supabase.from("friendships").delete().eq("id", id);
    reload();
  }

  const acceptedIds = new Set(
    accepted.map((r) => (r.requester_id === user?.id ? r.addressee_id : r.requester_id)),
  );
  const pendingIds = new Set([
    ...outgoing.map((r) => r.addressee_id),
    ...incoming.map((r) => r.requester_id),
  ]);

  return (
    <div className="space-y-5">
      <section className="koth-stripe overflow-hidden rounded-3xl bg-koth-black p-5 text-koth-white">
        <p className="label-broadcast text-koth-white/60">Friends</p>
        <h1 className="mt-1 text-xl font-bold">Find your circle</h1>
      </section>

      <div>
        <Input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search usernames…"
          autoCapitalize="none"
          className="h-12 rounded-full"
        />
      </div>

      {results.length > 0 && (
        <Section title="Results">
          {results.map((p) => (
            <Row
              key={p.id}
              p={p}
              right={
                acceptedIds.has(p.id) ? (
                  <span className="pill bg-koth-pr-bg text-koth-pr-text">friends</span>
                ) : pendingIds.has(p.id) ? (
                  <span className="pill bg-muted text-muted-foreground">pending</span>
                ) : (
                  <Button
                    onClick={() => send(p.id)}
                    size="sm"
                    className="tap-44 rounded-full bg-koth-red text-koth-white hover:bg-koth-red/90"
                  >
                    <UserPlus className="mr-1 h-4 w-4" aria-hidden />
                    Add
                  </Button>
                )
              }
            />
          ))}
        </Section>
      )}

      {incoming.length > 0 && (
        <Section title="Incoming requests">
          {incoming.map((r) => {
            const p = r.req;
            return (
              <Row
                key={r.id}
                p={{ ...p, id: r.requester_id }}
                right={
                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      onClick={() => accept(r.id)}
                      className="tap-44 rounded-full bg-koth-red text-koth-white"
                    >
                      <Check className="h-4 w-4" aria-hidden />
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => remove(r.id)}
                      className="tap-44 rounded-full"
                    >
                      <X className="h-4 w-4" aria-hidden />
                    </Button>
                  </div>
                }
              />
            );
          })}
        </Section>
      )}

      {outgoing.length > 0 && (
        <Section title="Sent">
          {outgoing.map((r) => (
            <Row
              key={r.id}
              p={{ ...r.addr, id: r.addressee_id }}
              right={<span className="pill bg-muted text-muted-foreground">pending</span>}
            />
          ))}
        </Section>
      )}

      <Section title={`Friends · ${accepted.length}`}>
        {accepted.length === 0 ? (
          <p className="px-1 py-3 text-sm text-muted-foreground">No friends yet.</p>
        ) : (
          accepted.map((r) => {
            const p = r.requester_id === user?.id ? r.addr : r.req;
            const pid = r.requester_id === user?.id ? r.addressee_id : r.requester_id;
            return (
              <Row
                key={r.id}
                p={{ ...p, id: pid }}
                right={
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => remove(r.id)}
                    className="tap-44 rounded-full"
                  >
                    Remove
                  </Button>
                }
              />
            );
          })
        )}
      </Section>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="space-y-2">
      <h2 className="label-broadcast text-muted-foreground">{title}</h2>
      <div className="rounded-3xl border border-border bg-card">
        <div className="divide-y divide-border">{children}</div>
      </div>
    </section>
  );
}

function Row({ p, right }: { p: any; right: React.ReactNode }) {
  return (
    <div className="flex items-center gap-3 px-4 py-3">
      <Avatar name={p?.display_name ?? p?.username ?? "?"} avatarPath={p?.avatar_url} size={36} />
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-semibold text-foreground">{p?.display_name}</p>
        <p className="truncate text-xs text-muted-foreground">@{p?.username}</p>
      </div>
      {right}
    </div>
  );
}
