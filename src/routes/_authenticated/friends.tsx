import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { Avatar } from "@/components/koth/avatar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Check, UserPlus, X, Users, Play } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { formatValue, getVideoSignedUrl } from "@/lib/koth-utils";
import { TikTokPlayer, type PlayerItem } from "@/components/koth/tiktok-player";

export const Route = createFileRoute("/_authenticated/friends")({
  head: () => ({ meta: [{ title: "Friends — KOTH" }] }),
  component: Friends,
});

type Tab = "feed" | "add";

function Friends() {
  const [tab, setTab] = useState<Tab>("feed");

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 gap-2 rounded-full border border-border bg-card p-1">
        <button
          onClick={() => setTab("feed")}
          className={cn(
            "tap-44 rounded-full py-2 text-sm font-bold transition-colors",
            tab === "feed" ? "bg-koth-red text-koth-white" : "text-muted-foreground",
          )}
        >
          Friends Feed
        </button>
        <button
          onClick={() => setTab("add")}
          className={cn(
            "tap-44 rounded-full py-2 text-sm font-bold transition-colors",
            tab === "add" ? "bg-koth-red text-koth-white" : "text-muted-foreground",
          )}
        >
          Add Friends
        </button>
      </div>

      {tab === "feed" ? <FeedTab onAdd={() => setTab("add")} /> : <AddTab />}
    </div>
  );
}

function FeedTab({ onAdd }: { onAdd: () => void }) {
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

  const feedQ = useQuery({
    queryKey: ["feed", challengeQ.data?.id, friendsQ.data],
    enabled: !!challengeQ.data && !!friendsQ.data && friendsQ.data.length > 0,
    queryFn: async () => {
      const { data } = await supabase
        .from("submissions")
        .select(
          "id, user_id, self_reported_value, admin_verified_value, video_path, submitted_at, visibility, profiles!submissions_user_id_fkey(username, display_name, avatar_url)",
        )
        .eq("challenge_id", challengeQ.data!.id)
        .neq("status", "disqualified")
        .in("user_id", friendsQ.data!)
        .in("visibility", ["public", "friends_only"])
        .order("submitted_at", { ascending: false });
      return data ?? [];
    },
  });

  const c = challengeQ.data;
  const noFriends = friendsQ.data && friendsQ.data.length === 0;

  const items: PlayerItem[] = (feedQ.data ?? []).map((s: any) => ({
    id: s.id,
    video_path: s.video_path,
    value: Number(s.admin_verified_value ?? s.self_reported_value),
    unit_type: c?.unit_type,
    unit_label: c?.unit_label,
    challenge_title: c?.title ?? null,
    user: {
      id: s.user_id ?? "",
      username: s.profiles?.username ?? "user",
      display_name: s.profiles?.display_name,
      avatar_url: s.profiles?.avatar_url,
    },
  }));

  const [playerOpen, setPlayerOpen] = useState(false);
  const [playerIndex, setPlayerIndex] = useState(0);

  return (
    <div className="space-y-4">
      <section className="koth-stripe overflow-hidden rounded-3xl bg-koth-black p-5 text-koth-white">
        <p className="label-broadcast text-koth-white/60">Friends feed</p>
        <h1 className="mt-1 text-xl font-bold">{c?.title ?? "No active challenge"}</h1>
      </section>

      {noFriends && (
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
      )}

      {items.map((it, i) => {
        const s = (feedQ.data ?? [])[i] as any;
        const p = s.profiles;
        return (
          <article key={it.id} className="overflow-hidden rounded-3xl border border-border bg-card">
            <div className="flex items-center gap-3 p-4">
              <Avatar name={p?.display_name ?? p?.username} avatarPath={p?.avatar_url} size={40} />
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold text-foreground">{p?.display_name}</p>
                <p className="truncate text-xs text-muted-foreground">
                  @{p?.username}
                  {s.visibility === "friends_only" && (
                    <span className="ml-2 rounded-full bg-muted px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                      Friends only
                    </span>
                  )}
                </p>
              </div>
              {c && (
                <div className="mono-stat text-lg font-bold text-foreground">
                  {formatValue(it.value!, c.unit_type, c.unit_label)}
                </div>
              )}
            </div>
            <button
              type="button"
              onClick={() => {
                setPlayerIndex(i);
                setPlayerOpen(true);
              }}
              className="relative block w-full"
              aria-label="Play attempt"
            >
              <AutoPlayVideo path={s.video_path} />
              <span className="pointer-events-none absolute bottom-3 left-3 inline-flex items-center gap-1 rounded-full bg-black/50 px-2 py-1 text-[11px] font-bold text-white backdrop-blur">
                <Play className="h-3 w-3" fill="currentColor" /> Tap to watch attempt
              </span>
            </button>
          </article>
        );
      })}

      <TikTokPlayer
        items={items}
        startIndex={playerIndex}
        open={playerOpen}
        onOpenChange={setPlayerOpen}
      />
    </div>
  );
}

function AutoPlayVideo({ path }: { path: string }) {
  const [url, setUrl] = useState<string | null>(null);
  const ref = useRef<HTMLVideoElement | null>(null);

  useEffect(() => {
    let active = true;
    getVideoSignedUrl(path).then((u) => {
      if (active) setUrl(u);
    });
    return () => {
      active = false;
    };
  }, [path]);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          if (e.isIntersecting) el.play().catch(() => {});
          else el.pause();
        }
      },
      { threshold: 0.5 },
    );
    io.observe(el);
    return () => io.disconnect();
  }, [url]);

  if (!url) return <div className="aspect-[9/16] w-full bg-black" />;
  return (
    <video
      ref={ref}
      src={url}
      muted
      loop
      playsInline
      className="pointer-events-none aspect-[9/16] w-full bg-black object-cover"
    />
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
