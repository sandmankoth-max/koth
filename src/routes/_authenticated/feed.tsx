import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { Avatar } from "@/components/koth/avatar";
import { formatValue, getVideoSignedUrl } from "@/lib/koth-utils";
import { Users } from "lucide-react";

export const Route = createFileRoute("/_authenticated/feed")({
  head: () => ({ meta: [{ title: "Friends feed — KOTH" }] }),
  component: Feed,
});

function Feed() {
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
          "id, self_reported_value, admin_verified_value, video_path, submitted_at, profiles!submissions_user_id_fkey(username, display_name, avatar_url)",
        )
        .eq("challenge_id", challengeQ.data!.id)
        .neq("status", "disqualified")
        .in("visibility", ["public", "friends_only"])
        .in("user_id", friendsQ.data!)
        .order("submitted_at", { ascending: false });
      return data ?? [];
    },
  });

  const c = challengeQ.data;

  return (
    <div className="space-y-4">
      <section className="koth-stripe overflow-hidden rounded-3xl bg-koth-black p-5 text-koth-white">
        <p className="label-broadcast text-koth-white/60">Friends feed</p>
        <h1 className="mt-1 text-xl font-bold">{c?.title ?? "No active challenge"}</h1>
        <Link
          to="/friends"
          className="tap-44 mt-3 inline-flex items-center rounded-full bg-koth-white/10 px-4 py-2 text-sm font-bold text-koth-white"
        >
          <Users className="mr-2 h-4 w-4" aria-hidden /> Add friends
        </Link>
      </section>

      {(!friendsQ.data || friendsQ.data.length === 0) && (
        <div className="rounded-3xl border border-dashed border-border bg-card p-8 text-center">
          <Users className="mx-auto h-8 w-8 text-muted-foreground" aria-hidden />
          <p className="mt-3 label-broadcast text-muted-foreground">No friends yet</p>
          <p className="mt-1 text-sm text-muted-foreground">Add friends to see their attempts here.</p>
        </div>
      )}

      {feedQ.data?.map((s) => {
        const p = (s as any).profiles;
        return (
          <article key={s.id} className="overflow-hidden rounded-3xl border border-border bg-card">
            <div className="flex items-center gap-3 p-4">
              <Avatar name={p?.display_name ?? p?.username} avatarPath={p?.avatar_url} size={40} />
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold text-foreground">{p?.display_name}</p>
                <p className="truncate text-xs text-muted-foreground">@{p?.username}</p>
              </div>
              {c && (
                <div className="mono-stat text-lg font-bold text-foreground">
                  {formatValue(Number(s.admin_verified_value ?? s.self_reported_value), c.unit_type, c.unit_label)}
                </div>
              )}
            </div>
            <AutoPlayVideo path={s.video_path} />
          </article>
        );
      })}
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
      controls
      className="aspect-[9/16] w-full bg-black"
    />
  );
}
