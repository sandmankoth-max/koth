import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { Avatar } from "@/components/koth/avatar";
import { Button } from "@/components/ui/button";
import { TikTokPlayer, type PlayerItem } from "@/components/koth/tiktok-player";
import { VideoThumb } from "@/components/koth/video-thumb";
import { UserPlus, Lock, ArrowLeft, Users, Flag, Ban } from "lucide-react";
import { toast } from "sonner";
import { FriendsDialog } from "./profile";
import { PromptDialog } from "@/components/koth/prompt-dialog";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";



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
  const [reportOpen, setReportOpen] = useState(false);
  const [blockOpen, setBlockOpen] = useState(false);
  const [blockBusy, setBlockBusy] = useState(false);



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

  const blockQ = useQuery({
    queryKey: ["block", user?.id, profileId],
    enabled: !!user && !!profileId && !isSelf,
    queryFn: async () => {
      const { data } = await supabase.from("user_blocks")
        .select("id")
        .eq("blocker_id", user!.id)
        .eq("blocked_id", profileId!)
        .maybeSingle();
      return !!data;
    },
  });
  const isBlocked = !!blockQ.data;


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
    enabled: !!profileId && canSeeAll,
    queryFn: async () => {
      const { data } = await supabase.from("submissions").select(
        "id, video_path, self_reported_value, admin_verified_value, submitted_at, visibility, is_active_entry, status, admin_color, challenges(id, title, unit_type, unit_label)",
      ).eq("user_id", profileId!).order("submitted_at", { ascending: false });
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
    admin_color: s.admin_color,
    user: { id: p.id, username: p.username, display_name: p.display_name, avatar_url: p.avatar_url },
  }));

  return (
    <div className="space-y-3">
      <div className="flex items-start justify-between">
        <button onClick={() => navigate({ to: "/feed" })} className="tap-44 -ml-2 inline-flex items-center gap-1 text-sm text-muted-foreground">
          <ArrowLeft className="h-4 w-4" /> Back
        </button>
        <div className="flex flex-col items-end gap-1">
          <button
            onClick={() => { if (canSeeAll) setFriendsOpen(true); else toast.message("Add as friend to see their friends list"); }}
            className="tap-44 inline-flex items-center gap-1 rounded-full border border-border bg-card px-2.5 py-1 text-[11px] font-semibold text-foreground"
          >
            <Users className="h-3 w-3 text-koth-red" />
            <span className="mono-stat font-bold">{countsQ.data ?? 0}</span>
            <span className="text-muted-foreground">friends</span>
            {!canSeeAll && <Lock className="h-3 w-3 text-muted-foreground" />}
          </button>
          {!isSelf && (
            <div className="flex items-center gap-1">
              <button
                onClick={() => setBlockOpen(true)}
                className="tap-44 inline-flex items-center justify-center rounded-full border border-border bg-card p-1.5 text-muted-foreground hover:text-koth-red"
                aria-label={isBlocked ? "Unblock user" : "Block user"}
                title={isBlocked ? "Unblock user" : "Block user"}
              >
                <Ban className={`h-4 w-4 ${isBlocked ? "text-koth-red" : ""}`} />
              </button>
              <button
                onClick={() => setReportOpen(true)}
                className="tap-44 inline-flex items-center justify-center rounded-full border border-border bg-card p-1.5 text-muted-foreground hover:text-koth-red"
                aria-label="Report user"
              >
                <Flag className="h-4 w-4" />
              </button>
            </div>
          )}

        </div>
      </div>

      <section className="flex flex-col items-center text-center">
        <Avatar name={p.display_name ?? p.username} avatarPath={p.avatar_url} size={72} />
        <h1 className="mt-2 text-base font-bold text-foreground">{p.display_name}</h1>
        <p className="text-xs text-muted-foreground">@{p.username}</p>

        {canSeeAll && p.bio && <p className="mt-2 max-w-[240px] text-xs text-foreground/85 line-clamp-2">{p.bio}</p>}

        {!isSelf && (
          <div className="mt-3 w-full max-w-xs space-y-2">
            {isBlocked ? (
              <span className="pill bg-koth-red/10 text-koth-red">Blocked</span>
            ) : friendQ.data?.status === "accepted" ? (
              <span className="pill bg-koth-pr-bg text-koth-pr-text">Friends</span>
            ) : friendQ.data?.status === "pending" ? (
              <span className="pill bg-muted text-muted-foreground">Request pending</span>
            ) : (
              <Button onClick={sendRequest} className="tap-44 h-10 w-full rounded-full bg-koth-red text-koth-white hover:bg-koth-red/90 text-sm">
                <UserPlus className="mr-2 h-4 w-4" /> Add friend
              </Button>
            )}
          </div>
        )}

      </section>

      {isBlocked && (
        <div className="flex items-center gap-2 rounded-2xl border border-dashed border-border bg-card p-3 text-xs text-muted-foreground">
          <Ban className="h-4 w-4 text-koth-red" /> You've blocked @{p.username}. They can't view your profile, videos, or interact with you.
        </div>
      )}


      {!canSeeAll && (
        <div className="flex items-center gap-2 rounded-2xl border border-dashed border-border bg-card p-3 text-xs text-muted-foreground">
          <Lock className="h-4 w-4" /> Add @{p.username} as a friend to see any of their content.
        </div>
      )}


      {canSeeAll && (
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
                          <span className="rounded-full bg-koth-red px-1.5 py-0.5 text-[9px] font-bold uppercase text-white">Rejected</span>
                        ) : s.visibility === "friends_only" ? (
                          <span className="rounded-full bg-koth-black/70 px-1.5 py-0.5 text-[9px] font-bold uppercase text-koth-white">Friends</span>
                        ) : s.status === "verified" ? (
                          <span className="rounded-full bg-koth-pr-bg px-1.5 py-0.5 text-[9px] font-bold uppercase text-koth-pr-text">Verified</span>
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
      )}


      <TikTokPlayer items={items} startIndex={playerIndex} open={playerOpen} onOpenChange={setPlayerOpen} />
      <FriendsDialog open={friendsOpen} onOpenChange={setFriendsOpen} userId={profileId ?? null} canView={canSeeAll} />
      <PromptDialog
        open={reportOpen}
        onOpenChange={setReportOpen}
        title={`Report @${p.username}?`}
        description="Tell us what's going on. Reports are reviewed by our moderation team."
        placeholder="Describe the issue (3–1000 characters)"
        confirmLabel="Submit report"
        destructive
        required
        onConfirm={async (reason) => {
          if (!reason.trim() || !profileId) return;
          setReportOpen(false);
          const { error } = await supabase.rpc("submit_user_report" as any, {
            p_reported_user_id: profileId,
            p_reason: reason.trim(),
          });
          if (error) toast.error(error.message);
          else toast.success("Report submitted. Thank you.");
        }}
      />

      <AlertDialog open={blockOpen} onOpenChange={(o) => !blockBusy && setBlockOpen(o)}>
        <AlertDialogContent className="max-w-sm rounded-2xl">
          <AlertDialogHeader>
            <AlertDialogTitle>{isBlocked ? `Unblock @${p.username}?` : `Block @${p.username}?`}</AlertDialogTitle>
            <AlertDialogDescription>
              {isBlocked
                ? "They'll be able to view your profile, videos, and interact with you again."
                : "They won't be able to view your profile, videos (including challenge submissions), comment or like your content, or send you a friend request. Any existing friendship will be removed."}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={blockBusy} className="rounded-full">Cancel</AlertDialogCancel>
            <AlertDialogAction
              disabled={blockBusy}
              onClick={async (e) => {
                e.preventDefault();
                if (!user || !profileId) return;
                setBlockBusy(true);
                try {
                  if (isBlocked) {
                    const { error } = await supabase.rpc("unblock_user" as any, { _target: profileId });
                    if (error) throw error;
                    toast.success("Unblocked");
                  } else {
                    const { error } = await supabase.rpc("block_username" as any, { _username: p.username });
                    if (error) throw error;
                    toast.success("Blocked");
                  }
                  await Promise.all([blockQ.refetch(), friendQ.refetch()]);
                  setBlockOpen(false);
                } catch (err) {
                  toast.error(err instanceof Error ? err.message : "Action failed");
                } finally {
                  setBlockBusy(false);
                }
              }}
              className="rounded-full bg-koth-red text-koth-white hover:bg-koth-red/90"
            >
              {blockBusy ? "Working…" : isBlocked ? "Unblock" : "Block"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>



      {isSelf && (
        <Link to="/profile" className="tap-44 block rounded-2xl border border-border bg-card px-4 py-3 text-center text-sm font-semibold text-foreground">
          Edit your profile →
        </Link>
      )}
    </div>
  );
}
