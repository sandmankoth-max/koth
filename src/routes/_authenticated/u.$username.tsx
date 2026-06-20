import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { Avatar } from "@/components/koth/avatar";
import { Button } from "@/components/ui/button";
import { TikTokPlayer, type PlayerItem } from "@/components/koth/tiktok-player";
import { VideoThumb } from "@/components/koth/video-thumb";
import { UserPlus, Lock, ArrowLeft, Users } from "lucide-react";
import { toast } from "sonner";
import { FriendsDialog } from "./profile";

export const Route = createFileRoute("/_authenticated/u/$username")({
  head: ({ params }) => ({ meta: [{ title: `@${params.username} — KOTH` }] }),
  component: UserProfile,
});

function UserProfile() {
  const { username } = Route.useParams();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [playerOpen, setPlayerOpen] = useState(false);
  const [playerIndex, setPlayerIndex] = useState(0);
  const [friendsOpen, setFriendsOpen] = useState(false);

  const profileQ = useQuery({
    queryKey: ["profile-by-username", username],
    queryFn: async () => {
      const { data } = await supabase.from("profiles")
        .select("id, username, display_name, avatar_url, bio")
        .eq("username", username.toLowerCase()).maybeSingle();
      return data;
    },
  });

  const profileId = profileQ.data?.id;
  const isSelf = !!user && profileId === user.id;

  const friendQ = useQuery({
    queryKey: ["friendship", user?.id, profileId],
    enabled: !!user && !!profileId && !isSelf,
    queryFn: async () => {
      const { data } = await supabase.from("friendships")
        .select("id, status, requester_id, addressee_id")
        .or(`and(requester_id.eq.${user!.id},addressee_id.eq.${profileId}),and(requester_id.eq.${profileId},addressee_id.eq.${user!.id})`)
        .maybeSingle();
      return data;
    },
  });

  const isFriend = friendQ.data?.status === "accepted";
  const canSeeAll = isSelf || isFriend;

  const countsQ = useQuery({
    queryKey: ["friend-count", profileId],
    enabled: !!profileId,
    queryFn: async () => {
      const { count } = await supabase.from("friendships")
        .select("*", { count: "exact", head: true })
        .eq("status", "accepted")
        .or(`requester_id.eq.${profileId},addressee_id.eq.${profileId}`);
      return count ?? 0;
    },
  });

  const videosQ = useQuery({
    queryKey: ["user-videos", profileId, canSeeAll],
    enabled: !!profileId,
    queryFn: async () => {
      const q = supabase.from("submissions").select(
        "id, video_path, self_reported_value, admin_verified_value, submitted_at, visibility, is_active_entry, status, challenges(id, title, unit_type, unit_label)",
      ).eq("user_id", profileId!).order("submitted_at", { ascending: false });
      const { data } = canSeeAll ? await q : await q.limit(1);
      return (data ?? []).filter((s: any) =>
        s.challenges && (s.visibility === "friends_only" || s.is_active_entry || s.status === "disqualified"),
      );
    },
  });

  async function sendRequest() {
    if (!user || !profileId) return;
    const { error } = await supabase.from("friendships")
      .insert({ requester_id: user.id, addressee_id: profileId, status: "pending" });
    if (error) toast.error(error.message);
    else { toast.success("Friend request sent"); friendQ.refetch(); }
  }

  if (profileQ.isLoading) return <p className="p-6 text-sm text-muted-foreground">Loading…</p>;
  if (!profileQ.data) return <p className="p-6 text-sm text-muted-foreground">User not found.</p>;
  const p = profileQ.data;

  const items: PlayerItem[] = (videosQ.data ?? []).map((s: any) => ({
    id: s.id, video_path: s.video_path,
    value: Number(s.admin_verified_value ?? s.self_reported_value),
    unit_type: s.challenges?.unit_type, unit_label: s.challenges?.unit_label,
    challenge_title: s.challenges?.title,
    user: { id: p.id, username: p.username, display_name: p.display_name, avatar_url: p.avatar_url },
  }));

  return (
    <div className="space-y-5">
      <button onClick={() => navigate({ to: "/feed" })} className="tap-44 -ml-2 inline-flex items-center gap-1 text-sm text-muted-foreground">
        <ArrowLeft className="h-4 w-4" /> Back
      </button>

      <section className="flex flex-col items-center text-center">
        <Avatar name={p.display_name ?? p.username} avatarPath={p.avatar_url} size={104} />
        <h1 className="mt-3 text-lg font-bold text-foreground">{p.display_name}</h1>
        <p className="text-sm text-muted-foreground">@{p.username}</p>

        <button
          onClick={() => { if (canSeeAll) setFriendsOpen(true); else toast.message("Add as friend to see their friends list"); }}
          className="tap-44 mt-3 inline-flex items-center gap-1.5 rounded-full border border-border bg-card px-4 py-1.5 text-sm font-semibold text-foreground"
        >
          <Users className="h-4 w-4 text-koth-red" />
          <span className="mono-stat font-bold">{countsQ.data ?? 0}</span>
          <span className="text-muted-foreground">friends</span>
          {!canSeeAll && <Lock className="h-3 w-3 text-muted-foreground" />}
        </button>

        {canSeeAll && p.bio && <p className="mt-3 max-w-xs text-sm text-foreground/85">{p.bio}</p>}

        {!isSelf && (
          <div className="mt-4 w-full max-w-xs">
            {friendQ.data?.status === "accepted" ? (
              <span className="pill bg-koth-pr-bg text-koth-pr-text">Friends</span>
            ) : friendQ.data?.status === "pending" ? (
              <span className="pill bg-muted text-muted-foreground">Request pending</span>
            ) : (
              <Button onClick={sendRequest} className="tap-44 h-11 w-full rounded-full bg-koth-red text-koth-white hover:bg-koth-red/90">
                <UserPlus className="mr-2 h-4 w-4" /> Add friend
              </Button>
            )}
          </div>
        )}
      </section>

      {!canSeeAll && (
        <div className="flex items-center gap-2 rounded-2xl border border-dashed border-border bg-card p-3 text-xs text-muted-foreground">
          <Lock className="h-4 w-4" /> Add @{p.username} as a friend to see their full grid.
        </div>
      )}

      <section>
        {items.length === 0 ? (
          <p className="text-center text-sm text-muted-foreground">No videos to show.</p>
        ) : (
          <div className="grid grid-cols-3 gap-[2px]">
            {(videosQ.data ?? []).map((s: any, i: number) => {
              const it = items[i];
              const title = s.challenges?.title as string | undefined;
              return (
                <div key={it.id} className="relative">
                  <VideoThumb
                    videoPath={it.video_path}
                    className="rounded-none"
                    onClick={() => { setPlayerIndex(i); setPlayerOpen(true); }}
                    badge={
                      s.status === "disqualified" ? (
                        <span className="rounded-full bg-koth-red px-1.5 py-0.5 text-[9px] font-bold uppercase text-white">Suspended</span>
                      ) : s.status === "verified" ? (
                        <span className="rounded-full bg-koth-pr-bg px-1.5 py-0.5 text-[9px] font-bold uppercase text-koth-pr-text">Verified</span>
                      ) : s.visibility === "friends_only" ? (
                        <span className="rounded-full bg-koth-black/70 px-1.5 py-0.5 text-[9px] font-bold uppercase text-koth-white">Friends</span>
                      ) : (
                        <span className="rounded-full bg-koth-red/85 px-1.5 py-0.5 text-[9px] font-bold uppercase text-white">Attempt</span>
                      )
                    }
                  />
                  {title && (
                    <div className="pointer-events-none absolute inset-x-1 bottom-1 rounded-md bg-black/60 px-1.5 py-0.5 text-center backdrop-blur">
                      <p className="truncate text-[10px] font-bold uppercase tracking-wide text-white">{title}</p>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </section>

      <TikTokPlayer items={items} startIndex={playerIndex} open={playerOpen} onOpenChange={setPlayerOpen} />
      <FriendsDialog open={friendsOpen} onOpenChange={setFriendsOpen} userId={profileId ?? null} canView={canSeeAll} />

      {isSelf && (
        <Link to="/profile" className="tap-44 block rounded-2xl border border-border bg-card px-4 py-3 text-center text-sm font-semibold text-foreground">
          Edit your profile →
        </Link>
      )}
    </div>
  );
}
